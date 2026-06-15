
-- =========================================================================
-- Phase 1b: tables, policies, data migration
-- =========================================================================

-- FIRMS
CREATE TABLE IF NOT EXISTS public.firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  is_always_free boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.firms TO authenticated;
GRANT ALL ON public.firms TO service_role;
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS firms_set_updated_at ON public.firms;
CREATE TRIGGER firms_set_updated_at BEFORE UPDATE ON public.firms
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- FIRM MEMBERS
CREATE TABLE IF NOT EXISTS public.firm_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.firm_member_role NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, user_id)
);
CREATE INDEX IF NOT EXISTS firm_members_user_idx ON public.firm_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.firm_members TO authenticated;
GRANT ALL ON public.firm_members TO service_role;
ALTER TABLE public.firm_members ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS firm_members_set_updated_at ON public.firm_members;
CREATE TRIGGER firm_members_set_updated_at BEFORE UPDATE ON public.firm_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- HELPER FUNCTIONS (SECURITY DEFINER — each queries a table other than the one they protect to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.has_firm_access(_user_id uuid, _firm_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.firm_members WHERE user_id = _user_id AND firm_id = _firm_id)
$$;

CREATE OR REPLACE FUNCTION public.get_user_firm_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT firm_id FROM public.firm_members WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_firm_owner(_user_id uuid, _firm_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.firm_members WHERE user_id = _user_id AND firm_id = _firm_id AND role = 'owner')
$$;

-- Lock down direct EXECUTE to authenticated only (no anon access to helpers)
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_firm_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_firm_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_firm_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_firm_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_firm_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_firm_owner(uuid, uuid) TO authenticated, service_role;

-- POLICIES: firms / firm_members
CREATE POLICY "firm members read own firm" ON public.firms
  FOR SELECT TO authenticated USING (public.has_firm_access(auth.uid(), id));
CREATE POLICY "firm owners update own firm" ON public.firms
  FOR UPDATE TO authenticated USING (public.is_firm_owner(auth.uid(), id))
  WITH CHECK (public.is_firm_owner(auth.uid(), id));
CREATE POLICY "super_admin reads firms" ON public.firms
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super_admin updates firms" ON public.firms
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "firm members read own membership rows" ON public.firm_members
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_firm_access(auth.uid(), firm_id));
CREATE POLICY "firm owners manage members" ON public.firm_members
  FOR ALL TO authenticated USING (public.is_firm_owner(auth.uid(), firm_id))
  WITH CHECK (public.is_firm_owner(auth.uid(), firm_id));
CREATE POLICY "super_admin reads memberships" ON public.firm_members
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL UNIQUE REFERENCES public.firms(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  tier public.subscription_tier NOT NULL DEFAULT 'starter',
  status public.subscription_status NOT NULL DEFAULT 'incomplete',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "firm members read own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.has_firm_access(auth.uid(), firm_id));
CREATE POLICY "super_admin reads subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- BILLING EVENTS
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid REFERENCES public.firms(id) ON DELETE SET NULL,
  stripe_event_id text NOT NULL UNIQUE,
  type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_events_firm_idx ON public.billing_events(firm_id, occurred_at DESC);
GRANT SELECT ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm members read own billing events" ON public.billing_events
  FOR SELECT TO authenticated USING (firm_id IS NOT NULL AND public.has_firm_access(auth.uid(), firm_id));
CREATE POLICY "super_admin reads billing events" ON public.billing_events
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- ACCESS INVITES
CREATE TABLE IF NOT EXISTS public.access_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.firm_member_role NOT NULL DEFAULT 'staff',
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS access_invites_firm_idx ON public.access_invites(firm_id);
CREATE INDEX IF NOT EXISTS access_invites_email_idx ON public.access_invites(lower(email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_invites TO authenticated;
GRANT ALL ON public.access_invites TO service_role;
ALTER TABLE public.access_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm owners manage invites" ON public.access_invites
  FOR ALL TO authenticated USING (public.is_firm_owner(auth.uid(), firm_id))
  WITH CHECK (public.is_firm_owner(auth.uid(), firm_id));
CREATE POLICY "super_admin reads invites" ON public.access_invites
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- SIGNUP REQUESTS
CREATE TABLE IF NOT EXISTS public.signup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.signup_requests TO authenticated;
GRANT ALL ON public.signup_requests TO service_role;
ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS signup_requests_set_updated_at ON public.signup_requests;
CREATE TRIGGER signup_requests_set_updated_at BEFORE UPDATE ON public.signup_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "super_admin reads signup_requests" ON public.signup_requests
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super_admin updates signup_requests" ON public.signup_requests
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- AUDIT LOG (append-only — no UPDATE/DELETE policies)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  firm_id uuid REFERENCES public.firms(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  ip text,
  user_agent text,
  meta jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_firm_idx ON public.audit_log(firm_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON public.audit_log(actor_user_id, at DESC);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm members read own firm audit" ON public.audit_log
  FOR SELECT TO authenticated USING (firm_id IS NOT NULL AND public.has_firm_access(auth.uid(), firm_id));
CREATE POLICY "super_admin reads audit" ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- firm_id on existing tables
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.firms(id) ON DELETE RESTRICT;
ALTER TABLE public.xero_connections ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.firms(id) ON DELETE RESTRICT;
ALTER TABLE public.xero_connections ADD COLUMN IF NOT EXISTS access_token_enc bytea;
ALTER TABLE public.xero_connections ADD COLUMN IF NOT EXISTS refresh_token_enc bytea;
ALTER TABLE public.xero_connections ADD COLUMN IF NOT EXISTS enc_version smallint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS clients_firm_idx ON public.clients(firm_id);
CREATE INDEX IF NOT EXISTS xero_connections_firm_idx ON public.xero_connections(firm_id);

-- Data migration
DO $$
DECLARE
  v_advisor uuid;
  v_firm uuid;
  v_display text;
BEGIN
  SELECT ur.user_id INTO v_advisor
  FROM public.user_roles ur
  WHERE ur.role = 'advisor'
  ORDER BY ur.created_at ASC
  LIMIT 1;

  IF v_advisor IS NULL THEN
    RAISE NOTICE 'No advisor found; skipping data migration';
    RETURN;
  END IF;

  SELECT display_name INTO v_display FROM public.profiles WHERE id = v_advisor;

  INSERT INTO public.firms (name, owner_user_id, is_always_free)
  VALUES (COALESCE(v_display, 'Positive Traction'), v_advisor, true)
  RETURNING id INTO v_firm;

  INSERT INTO public.firm_members (firm_id, user_id, role)
  VALUES (v_firm, v_advisor, 'owner')
  ON CONFLICT (firm_id, user_id) DO NOTHING;

  UPDATE public.clients SET firm_id = v_firm WHERE owner_user_id = v_advisor AND firm_id IS NULL;
  UPDATE public.xero_connections SET firm_id = v_firm WHERE user_id = v_advisor AND firm_id IS NULL;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_advisor, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_advisor, 'firm_owner')
    ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.subscriptions (firm_id, tier, status)
  VALUES (v_firm, 'legacy', 'active')
  ON CONFLICT (firm_id) DO NOTHING;

  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  VALUES (v_advisor, v_firm, 'phase1_migration', 'firm', v_firm::text,
          jsonb_build_object('is_always_free', true, 'tier', 'legacy'));
END $$;

-- Firm-scoped policies on existing tables (additive — old policies retained for now)
CREATE POLICY "firm members read firm clients" ON public.clients
  FOR SELECT TO authenticated USING (firm_id IS NOT NULL AND public.has_firm_access(auth.uid(), firm_id));
CREATE POLICY "firm owners manage firm clients" ON public.clients
  FOR ALL TO authenticated USING (firm_id IS NOT NULL AND public.is_firm_owner(auth.uid(), firm_id))
  WITH CHECK (firm_id IS NOT NULL AND public.is_firm_owner(auth.uid(), firm_id));

CREATE POLICY "firm members read firm xero connections" ON public.xero_connections
  FOR SELECT TO authenticated USING (firm_id IS NOT NULL AND public.has_firm_access(auth.uid(), firm_id));
CREATE POLICY "firm owners manage firm xero connections" ON public.xero_connections
  FOR ALL TO authenticated USING (firm_id IS NOT NULL AND public.is_firm_owner(auth.uid(), firm_id))
  WITH CHECK (firm_id IS NOT NULL AND public.is_firm_owner(auth.uid(), firm_id));

-- Redacted admin view: ONLY firm/billing/usage summary. NEVER tenant ids, org names, client names, or financials.
CREATE OR REPLACE VIEW public.admin_firm_overview
WITH (security_invoker = true) AS
SELECT
  f.id                          AS firm_id,
  f.name                        AS firm_name,
  f.is_always_free,
  f.created_at                  AS firm_created_at,
  s.tier,
  s.status,
  s.trial_ends_at,
  s.current_period_end,
  s.cancel_at_period_end,
  COALESCE(xc.connection_count, 0) AS connection_count,
  COALESCE(be.recent_error_count, 0) AS recent_error_count
FROM public.firms f
LEFT JOIN public.subscriptions s ON s.firm_id = f.id
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS connection_count
  FROM public.xero_connections xc
  WHERE xc.firm_id = f.id
) xc ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS recent_error_count
  FROM public.billing_events be
  WHERE be.firm_id = f.id
    AND be.type LIKE '%failed%'
    AND be.occurred_at > now() - interval '30 days'
) be ON true;

GRANT SELECT ON public.admin_firm_overview TO authenticated;

-- Audit trigger on user_roles
CREATE OR REPLACE FUNCTION public.audit_user_roles_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_log (actor_user_id, action, target_type, target_id, meta)
  VALUES (auth.uid(),
          CASE WHEN TG_OP='INSERT' THEN 'role_granted'
               WHEN TG_OP='DELETE' THEN 'role_revoked'
               ELSE 'role_changed' END,
          'user_role',
          COALESCE(NEW.user_id::text, OLD.user_id::text),
          jsonb_build_object('role', COALESCE(NEW.role, OLD.role)));
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS audit_user_roles_change ON public.user_roles;
CREATE TRIGGER audit_user_roles_change
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles_change();
