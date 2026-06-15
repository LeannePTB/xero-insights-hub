
-- =========================================================
-- Phase 6b: hide role/membership helpers from the Data API
-- =========================================================

CREATE SCHEMA IF NOT EXISTS app_private;

-- 1) Recreate helpers inside app_private with identical bodies.
--    EXECUTE granted to authenticated/anon/service_role so RLS can call them.
--    PostgREST only exposes `public`, so these will not appear as /rpc/* endpoints.

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION app_private.is_advisor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'advisor') $$;

CREATE OR REPLACE FUNCTION app_private.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin') $$;

CREATE OR REPLACE FUNCTION app_private.has_firm_access(_user_id uuid, _firm_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.firm_members WHERE user_id = _user_id AND firm_id = _firm_id) $$;

CREATE OR REPLACE FUNCTION app_private.is_firm_owner(_user_id uuid, _firm_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.firm_members WHERE user_id = _user_id AND firm_id = _firm_id AND role = 'owner') $$;

CREATE OR REPLACE FUNCTION app_private.get_user_firm_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT firm_id FROM public.firm_members WHERE user_id = _user_id LIMIT 1 $$;

CREATE OR REPLACE FUNCTION app_private.has_client_access(_user_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.client_access WHERE user_id = _user_id AND client_id = _client_id) $$;

CREATE OR REPLACE FUNCTION app_private.has_tenant_access(_user_id uuid, _tenant_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_access ca
    JOIN public.client_xero_orgs cxo ON cxo.client_id = ca.client_id
    JOIN public.xero_connections xc ON xc.id = cxo.xero_connection_id
    WHERE ca.user_id = _user_id AND xc.tenant_id = _tenant_id
  )
$$;

CREATE OR REPLACE FUNCTION app_private.get_user_tier(_user_id uuid, _tenant_id text)
RETURNS public.dashboard_tier LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ca.tier
  FROM public.client_access ca
  JOIN public.client_xero_orgs cxo ON cxo.client_id = ca.client_id
  JOIN public.xero_connections xc ON xc.id = cxo.xero_connection_id
  WHERE ca.user_id = _user_id AND xc.tenant_id = _tenant_id
  ORDER BY CASE ca.tier WHEN 'investigate' THEN 3 WHEN 'advisory' THEN 2 ELSE 1 END DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION app_private.get_tier_widgets(_client_id uuid, _tier public.dashboard_tier)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT widgets FROM public.tier_widget_config WHERE client_id = _client_id AND tier = _tier),
    (SELECT widgets FROM public.tier_widget_config WHERE client_id IS NULL AND tier = _tier),
    ARRAY[]::text[]
  )
$$;

GRANT USAGE ON SCHEMA app_private TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO authenticated, anon, service_role;

-- 2) Repoint every RLS policy. Drop and recreate using app_private.*.

-- access_invites
DROP POLICY IF EXISTS "firm owners manage invites" ON public.access_invites;
CREATE POLICY "firm owners manage invites" ON public.access_invites
  USING (app_private.is_firm_owner(auth.uid(), firm_id))
  WITH CHECK (app_private.is_firm_owner(auth.uid(), firm_id));
DROP POLICY IF EXISTS "super_admin reads invites" ON public.access_invites;
CREATE POLICY "super_admin reads invites" ON public.access_invites
  FOR SELECT USING (app_private.is_super_admin(auth.uid()));

-- audit_log
DROP POLICY IF EXISTS "firm members read own firm audit" ON public.audit_log;
CREATE POLICY "firm members read own firm audit" ON public.audit_log
  FOR SELECT USING ((firm_id IS NOT NULL) AND app_private.has_firm_access(auth.uid(), firm_id));
DROP POLICY IF EXISTS "super_admin reads audit" ON public.audit_log;
CREATE POLICY "super_admin reads audit" ON public.audit_log
  FOR SELECT USING (app_private.is_super_admin(auth.uid()));

-- billing_events
DROP POLICY IF EXISTS "firm members read own billing events" ON public.billing_events;
CREATE POLICY "firm members read own billing events" ON public.billing_events
  FOR SELECT USING ((firm_id IS NOT NULL) AND app_private.has_firm_access(auth.uid(), firm_id));
DROP POLICY IF EXISTS "super_admin reads billing events" ON public.billing_events;
CREATE POLICY "super_admin reads billing events" ON public.billing_events
  FOR SELECT USING (app_private.is_super_admin(auth.uid()));

-- client_access
DROP POLICY IF EXISTS "advisors manage client access" ON public.client_access;
CREATE POLICY "advisors manage client access" ON public.client_access
  USING (app_private.is_advisor(auth.uid()))
  WITH CHECK (app_private.is_advisor(auth.uid()));

-- client_notes
DROP POLICY IF EXISTS "Advisors manage all notes" ON public.client_notes;
CREATE POLICY "Advisors manage all notes" ON public.client_notes
  USING (app_private.is_advisor(auth.uid()))
  WITH CHECK (app_private.is_advisor(auth.uid()));
DROP POLICY IF EXISTS "Client viewers read notes" ON public.client_notes;
CREATE POLICY "Client viewers read notes" ON public.client_notes
  FOR SELECT USING (app_private.has_client_access(auth.uid(), client_id));

-- client_xero_orgs
DROP POLICY IF EXISTS "advisors manage client xero orgs" ON public.client_xero_orgs;
CREATE POLICY "advisors manage client xero orgs" ON public.client_xero_orgs
  USING (app_private.is_advisor(auth.uid()))
  WITH CHECK (app_private.is_advisor(auth.uid()));
DROP POLICY IF EXISTS "viewers read assigned client xero orgs" ON public.client_xero_orgs;
CREATE POLICY "viewers read assigned client xero orgs" ON public.client_xero_orgs
  FOR SELECT USING (app_private.has_client_access(auth.uid(), client_id));

-- clients
DROP POLICY IF EXISTS "advisors manage clients" ON public.clients;
CREATE POLICY "advisors manage clients" ON public.clients
  USING (app_private.is_advisor(auth.uid()))
  WITH CHECK (app_private.is_advisor(auth.uid()));
DROP POLICY IF EXISTS "firm members read firm clients" ON public.clients;
CREATE POLICY "firm members read firm clients" ON public.clients
  FOR SELECT USING ((firm_id IS NOT NULL) AND app_private.has_firm_access(auth.uid(), firm_id));
DROP POLICY IF EXISTS "firm owners manage firm clients" ON public.clients;
CREATE POLICY "firm owners manage firm clients" ON public.clients
  USING ((firm_id IS NOT NULL) AND app_private.is_firm_owner(auth.uid(), firm_id))
  WITH CHECK ((firm_id IS NOT NULL) AND app_private.is_firm_owner(auth.uid(), firm_id));
DROP POLICY IF EXISTS "viewers read assigned clients" ON public.clients;
CREATE POLICY "viewers read assigned clients" ON public.clients
  FOR SELECT USING (app_private.has_client_access(auth.uid(), id));

-- firm_members
DROP POLICY IF EXISTS "firm members read own membership rows" ON public.firm_members;
CREATE POLICY "firm members read own membership rows" ON public.firm_members
  FOR SELECT USING ((user_id = auth.uid()) OR app_private.has_firm_access(auth.uid(), firm_id));
DROP POLICY IF EXISTS "firm owners manage members" ON public.firm_members;
CREATE POLICY "firm owners manage members" ON public.firm_members
  USING (app_private.is_firm_owner(auth.uid(), firm_id))
  WITH CHECK (app_private.is_firm_owner(auth.uid(), firm_id));
DROP POLICY IF EXISTS "super_admin reads memberships" ON public.firm_members;
CREATE POLICY "super_admin reads memberships" ON public.firm_members
  FOR SELECT USING (app_private.is_super_admin(auth.uid()));

-- firms
DROP POLICY IF EXISTS "firm members read own firm" ON public.firms;
CREATE POLICY "firm members read own firm" ON public.firms
  FOR SELECT USING (app_private.has_firm_access(auth.uid(), id));
DROP POLICY IF EXISTS "firm owners update own firm" ON public.firms;
CREATE POLICY "firm owners update own firm" ON public.firms
  FOR UPDATE USING (app_private.is_firm_owner(auth.uid(), id))
  WITH CHECK (app_private.is_firm_owner(auth.uid(), id));
DROP POLICY IF EXISTS "super_admin reads firms" ON public.firms;
CREATE POLICY "super_admin reads firms" ON public.firms
  FOR SELECT USING (app_private.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "super_admin updates firms" ON public.firms;
CREATE POLICY "super_admin updates firms" ON public.firms
  FOR UPDATE USING (app_private.is_super_admin(auth.uid()))
  WITH CHECK (app_private.is_super_admin(auth.uid()));

-- login_events
DROP POLICY IF EXISTS "Advisors view all login events" ON public.login_events;
CREATE POLICY "Advisors view all login events" ON public.login_events
  FOR SELECT USING (app_private.is_advisor(auth.uid()));

-- signup_requests
DROP POLICY IF EXISTS "super_admin reads signup_requests" ON public.signup_requests;
CREATE POLICY "super_admin reads signup_requests" ON public.signup_requests
  FOR SELECT USING (app_private.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "super_admin updates signup_requests" ON public.signup_requests;
CREATE POLICY "super_admin updates signup_requests" ON public.signup_requests
  FOR UPDATE USING (app_private.is_super_admin(auth.uid()))
  WITH CHECK (app_private.is_super_admin(auth.uid()));

-- subscriptions
DROP POLICY IF EXISTS "firm members read own subscription" ON public.subscriptions;
CREATE POLICY "firm members read own subscription" ON public.subscriptions
  FOR SELECT USING (app_private.has_firm_access(auth.uid(), firm_id));
DROP POLICY IF EXISTS "super_admin reads subscriptions" ON public.subscriptions;
CREATE POLICY "super_admin reads subscriptions" ON public.subscriptions
  FOR SELECT USING (app_private.is_super_admin(auth.uid()));

-- tier_settings
DROP POLICY IF EXISTS "Advisors can manage tier settings" ON public.tier_settings;
CREATE POLICY "Advisors can manage tier settings" ON public.tier_settings
  USING (app_private.is_advisor(auth.uid()))
  WITH CHECK (app_private.is_advisor(auth.uid()));

-- tier_widget_config
DROP POLICY IF EXISTS "Advisors manage tier widget config" ON public.tier_widget_config;
CREATE POLICY "Advisors manage tier widget config" ON public.tier_widget_config
  USING (app_private.has_role(auth.uid(), 'advisor'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'advisor'::public.app_role));
DROP POLICY IF EXISTS "Viewers read accessible tier widget config" ON public.tier_widget_config;
CREATE POLICY "Viewers read accessible tier widget config" ON public.tier_widget_config
  FOR SELECT USING ((client_id IS NULL) OR app_private.has_client_access(auth.uid(), client_id));

-- unreconciled_lines
DROP POLICY IF EXISTS "Advisors manage all lines" ON public.unreconciled_lines;
CREATE POLICY "Advisors manage all lines" ON public.unreconciled_lines
  USING (app_private.is_advisor(auth.uid()))
  WITH CHECK (app_private.is_advisor(auth.uid()));
DROP POLICY IF EXISTS "Viewers can read lines for their client" ON public.unreconciled_lines;
CREATE POLICY "Viewers can read lines for their client" ON public.unreconciled_lines
  FOR SELECT USING (app_private.has_client_access(auth.uid(), client_id));
DROP POLICY IF EXISTS "Viewers can update comments for their client" ON public.unreconciled_lines;
CREATE POLICY "Viewers can update comments for their client" ON public.unreconciled_lines
  FOR UPDATE USING (app_private.has_client_access(auth.uid(), client_id))
  WITH CHECK (app_private.has_client_access(auth.uid(), client_id));

-- unreconciled_uploads
DROP POLICY IF EXISTS "Advisors manage all uploads" ON public.unreconciled_uploads;
CREATE POLICY "Advisors manage all uploads" ON public.unreconciled_uploads
  USING (app_private.is_advisor(auth.uid()))
  WITH CHECK (app_private.is_advisor(auth.uid()));
DROP POLICY IF EXISTS "Viewers can read uploads for their client" ON public.unreconciled_uploads;
CREATE POLICY "Viewers can read uploads for their client" ON public.unreconciled_uploads
  FOR SELECT USING (app_private.has_client_access(auth.uid(), client_id));

-- user_roles
DROP POLICY IF EXISTS "advisors manage roles" ON public.user_roles;
CREATE POLICY "advisors manage roles" ON public.user_roles
  USING (app_private.is_advisor(auth.uid()))
  WITH CHECK (app_private.is_advisor(auth.uid()));

-- xero_connections
DROP POLICY IF EXISTS "firm members read firm xero connections" ON public.xero_connections;
CREATE POLICY "firm members read firm xero connections" ON public.xero_connections
  FOR SELECT USING ((firm_id IS NOT NULL) AND app_private.has_firm_access(auth.uid(), firm_id));
DROP POLICY IF EXISTS "firm owners manage firm xero connections" ON public.xero_connections;
CREATE POLICY "firm owners manage firm xero connections" ON public.xero_connections
  USING ((firm_id IS NOT NULL) AND app_private.is_firm_owner(auth.uid(), firm_id))
  WITH CHECK ((firm_id IS NOT NULL) AND app_private.is_firm_owner(auth.uid(), firm_id));

-- 3) Update enforce_unreconciled_line_viewer_columns trigger fn to use app_private.
CREATE OR REPLACE FUNCTION public.enforce_unreconciled_line_viewer_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF app_private.is_advisor(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.account_name IS DISTINCT FROM OLD.account_name
     OR NEW.account_number IS DISTINCT FROM OLD.account_number
     OR NEW.row_index IS DISTINCT FROM OLD.row_index
     OR NEW.txn_date IS DISTINCT FROM OLD.txn_date
     OR NEW.payee IS DISTINCT FROM OLD.payee
     OR NEW.reference IS DISTINCT FROM OLD.reference
     OR NEW.spent IS DISTINCT FROM OLD.spent
     OR NEW.received IS DISTINCT FROM OLD.received
     OR NEW.tax IS DISTINCT FROM OLD.tax
     OR NEW.source_comment IS DISTINCT FROM OLD.source_comment
     OR NEW.upload_id IS DISTINCT FROM OLD.upload_id
     OR NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'Viewers can only modify client_comment on unreconciled_lines';
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Add a tiny self-only wrapper in public so authenticated callers can ask
--    "am I a super-admin?" without being able to probe other users.
CREATE OR REPLACE FUNCTION public.me_is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
$$;
REVOKE EXECUTE ON FUNCTION public.me_is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.me_is_super_admin() TO authenticated, service_role;

-- 5) Drop the old public helpers. Policies no longer reference them.
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_advisor(uuid);
DROP FUNCTION IF EXISTS public.is_super_admin(uuid);
DROP FUNCTION IF EXISTS public.has_firm_access(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_firm_owner(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_user_firm_id(uuid);
DROP FUNCTION IF EXISTS public.has_client_access(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_tenant_access(uuid, text);
DROP FUNCTION IF EXISTS public.get_user_tier(uuid, text);
DROP FUNCTION IF EXISTS public.get_tier_widgets(uuid, public.dashboard_tier);
