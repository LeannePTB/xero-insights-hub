-- 1. OAuth state: new 'admin_onboard' flow, only for a super admin's own state row.
CREATE OR REPLACE FUNCTION public.tg_xero_oauth_states_validate()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 'reconnect' reauthorises a Xero organisation that is already linked, to
  -- pick up newly requested scopes. It needs a user like 'connect' does, but
  -- must never be gated by the plan limit — it is not a new Xero file.
  -- 'signup' is the pre-session Sign Up with Xero flow: like 'signin' it has
  -- no user yet, and it never links a firm or client.
  -- 'admin_onboard' is System Admin "Start from a Xero file": a super admin
  -- authorises files before any organisation exists. It never links a firm or
  -- client on the state row; the organisation is created later, atomically.
  IF NEW.flow NOT IN ('connect','signin','signup','onboard','reconnect','admin_onboard') THEN
    RAISE EXCEPTION 'xero_oauth_states.flow must be connect, signin, signup, onboard, reconnect or admin_onboard, got %', NEW.flow;
  END IF;
  IF NEW.flow IN ('connect','onboard','reconnect','admin_onboard') AND NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'xero_oauth_states.user_id is required for % flow', NEW.flow;
  END IF;
  IF NEW.flow = 'onboard' AND NEW.firm_id IS NULL THEN
    RAISE EXCEPTION 'xero_oauth_states.firm_id is required for onboard flow';
  END IF;
  IF NEW.flow = 'admin_onboard' THEN
    IF NEW.firm_id IS NOT NULL OR NEW.client_id IS NOT NULL THEN
      RAISE EXCEPTION 'admin_onboard states never carry an organisation or client';
    END IF;
    IF NOT app_private.is_super_admin(NEW.user_id) THEN
      RAISE EXCEPTION 'Not authorised.' USING errcode = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Pending onboard: token set + tenant list held server-side for 30 minutes.
CREATE TABLE public.xero_pending_onboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  access_token_enc bytea NOT NULL,
  refresh_token_enc bytea NOT NULL,
  token_expires_at timestamptz NOT NULL,
  scopes text,
  tenants jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tenants) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);
CREATE INDEX xero_pending_onboards_user ON public.xero_pending_onboards (user_id);
CREATE INDEX xero_pending_onboards_expires ON public.xero_pending_onboards (expires_at);
REVOKE ALL ON TABLE public.xero_pending_onboards FROM anon, authenticated, public;
GRANT ALL ON TABLE public.xero_pending_onboards TO service_role;
ALTER TABLE public.xero_pending_onboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY mfa_aal2_required ON public.xero_pending_onboards AS RESTRICTIVE FOR ALL TO authenticated USING (app_private.is_aal2()) WITH CHECK (app_private.is_aal2());
COMMENT ON TABLE public.xero_pending_onboards IS 'System Admin "Start from a Xero file": encrypted Xero tokens and tenant list for one super admin, 30 minutes, single use. No browser grants; reached only through caller-scoped definer functions. Purged nightly.';

CREATE OR REPLACE FUNCTION app_private.tg_xero_pending_onboards_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT app_private.is_super_admin(NEW.user_id) THEN
    RAISE EXCEPTION 'Not authorised.' USING errcode = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER xero_pending_onboards_guard BEFORE INSERT OR UPDATE ON public.xero_pending_onboards
  FOR EACH ROW EXECUTE FUNCTION app_private.tg_xero_pending_onboards_guard();

-- 3. Picker: the caller's own pending files, flagged when already in the app.
CREATE OR REPLACE FUNCTION public.admin_onboard_candidates(_pending_id uuid)
 RETURNS TABLE(tenant_id text, tenant_name text, already_linked boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.xero_pending_onboards%ROWTYPE;
BEGIN
  PERFORM app_private.assert_aal2();
  IF auth.uid() IS NULL OR NOT app_private.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised.' USING errcode = 'insufficient_privilege';
  END IF;
  SELECT * INTO p FROM public.xero_pending_onboards o
   WHERE o.id = _pending_id AND o.user_id = auth.uid() AND o.expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARD_EXPIRED' USING errcode = 'no_data_found';
  END IF;
  RETURN QUERY
    SELECT t->>'tenantId',
           coalesce(nullif(t->>'tenantName',''), 'Untitled organisation'),
           EXISTS (SELECT 1 FROM public.xero_connections c WHERE c.tenant_id = t->>'tenantId')
      FROM jsonb_array_elements(p.tenants) t
     WHERE coalesce(t->>'tenantId','') <> '';
END;
$function$;

-- 4. Create organisation + clients + Xero links atomically.
CREATE OR REPLACE FUNCTION public.admin_onboard_organisation_from_xero(
  _pending_id uuid,
  _first_tenant text,
  _extra_tenants text[],
  _org_name text,
  _client_limit integer,
  _billing_mode text,
  _advisory boolean,
  _consolidation boolean,
  _branding boolean,
  _white_label boolean,
  _cards text[]
)
 RETURNS TABLE(firm_id uuid, client_ids uuid[], tenant_ids text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := auth.uid();
  p public.xero_pending_onboards%ROWTYPE;
  _name text := btrim(coalesce(_org_name, ''));
  _wanted text[];
  _tenant text;
  _t jsonb;
  _firm uuid;
  _client uuid;
  _conn uuid;
  _clients uuid[] := '{}';
  _member record;
BEGIN
  PERFORM app_private.assert_aal2();
  IF _me IS NULL OR NOT app_private.is_super_admin(_me) THEN
    RAISE EXCEPTION 'Not authorised.' USING errcode = 'insufficient_privilege';
  END IF;

  -- Single use: lock the caller's own unexpired record.
  SELECT * INTO p FROM public.xero_pending_onboards o
   WHERE o.id = _pending_id AND o.user_id = _me AND o.expires_at > now()
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARD_EXPIRED' USING errcode = 'no_data_found';
  END IF;

  IF char_length(_name) < 2 OR char_length(_name) > 120 THEN
    RAISE EXCEPTION 'INVALID_ORGANISATION_NAME' USING errcode = 'check_violation';
  END IF;
  IF coalesce(_first_tenant, '') = '' THEN
    RAISE EXCEPTION 'FIRST_TENANT_REQUIRED' USING errcode = 'check_violation';
  END IF;

  SELECT array_agg(x ORDER BY ord) INTO _wanted FROM (
    SELECT DISTINCT ON (x) x, ord FROM unnest(array[_first_tenant] || coalesce(_extra_tenants, '{}')) WITH ORDINALITY AS u(x, ord)
     WHERE coalesce(x, '') <> '' ORDER BY x, ord
  ) d;

  IF _client_limit IS NULL OR _client_limit < 1 OR array_length(_wanted, 1) > _client_limit THEN
    RAISE EXCEPTION 'CLIENT_LIMIT_EXCEEDED' USING errcode = 'check_violation';
  END IF;

  -- Tenant ids are filters: each must be in this pending authorisation and
  -- not already in the app (any organisation, any person's connection).
  FOREACH _tenant IN ARRAY _wanted LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p.tenants) t WHERE t->>'tenantId' = _tenant) THEN
      RAISE EXCEPTION 'TENANT_NOT_AUTHORISED' USING errcode = 'insufficient_privilege';
    END IF;
    IF EXISTS (SELECT 1 FROM public.xero_connections c WHERE c.tenant_id = _tenant) THEN
      RAISE EXCEPTION 'TENANT_ALREADY_LINKED' USING errcode = 'unique_violation';
    END IF;
  END LOOP;

  -- Organisation, exactly as the manual path: never always-free; the creator
  -- is the owner until an invited owner takes over.
  INSERT INTO public.firms (name, is_always_free, owner_user_id) VALUES (_name, false, _me) RETURNING id INTO _firm;
  INSERT INTO public.subscriptions (firm_id, tier, status) VALUES (_firm, 'starter', 'active');
  INSERT INTO public.firm_members (firm_id, user_id, role, status) VALUES (_firm, _me, 'owner', 'active');

  FOR _member IN SELECT pt.user_id FROM public.practice_team pt WHERE pt.user_id <> _me LOOP
    INSERT INTO public.firm_members (firm_id, user_id, role, status) VALUES (_firm, _member.user_id, 'staff', 'active')
      ON CONFLICT (firm_id, user_id) DO NOTHING;
    INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
    VALUES (_me, _firm, 'practice_team_member_joined_new_organisation', 'firm', _firm::text,
            jsonb_build_object('firm_id', _firm, 'user_id', _member.user_id, 'role', 'staff'));
  END LOOP;

  -- The purchase, through the same audited control (re-checks every rule).
  PERFORM public.set_org_purchase(_firm, _client_limit, coalesce(_advisory, false), coalesce(_consolidation, false),
                                  coalesce(_branding, false), coalesce(_white_label, false), _billing_mode);
  IF _cards IS NOT NULL THEN
    PERFORM public.set_org_card_defaults(_firm, _cards);
  END IF;

  -- One client per file; plan-limit triggers still apply.
  FOREACH _tenant IN ARRAY _wanted LOOP
    SELECT t INTO _t FROM jsonb_array_elements(p.tenants) t WHERE t->>'tenantId' = _tenant LIMIT 1;
    INSERT INTO public.clients (name, owner_user_id, firm_id)
    VALUES (left(coalesce(nullif(btrim(_t->>'tenantName'), ''), 'Untitled organisation'), 120), _me, _firm)
    RETURNING id INTO _client;
    INSERT INTO public.xero_connections (user_id, tenant_id, tenant_name, tenant_type, access_token_enc, refresh_token_enc,
                                         expires_at, scopes, status, firm_id)
    VALUES (_me, _tenant, coalesce(nullif(_t->>'tenantName', ''), 'Untitled organisation'), _t->>'tenantType',
            p.access_token_enc, p.refresh_token_enc, p.token_expires_at, p.scopes, 'connected', _firm)
    RETURNING id INTO _conn;
    INSERT INTO public.client_xero_orgs (client_id, xero_connection_id) VALUES (_client, _conn);
    _clients := _clients || _client;
  END LOOP;

  -- Consume: the record and its token ciphertext are gone.
  DELETE FROM public.xero_pending_onboards WHERE id = p.id;

  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  VALUES (_me, _firm, 'organisation_created_from_xero', 'firm', _firm::text,
          jsonb_build_object('firm_id', _firm, 'client_count', array_length(_wanted, 1), 'tenant_ids', to_jsonb(_wanted),
                             'client_limit', _client_limit, 'advisory_enabled', coalesce(_advisory,false),
                             'consolidation_enabled', coalesce(_consolidation,false), 'branding_enabled', coalesce(_branding,false),
                             'white_label_enabled', coalesce(_white_label,false), 'billing_mode', _billing_mode,
                             'default_cards', to_jsonb(_cards)));

  RETURN QUERY SELECT _firm, _clients, _wanted;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_onboard_candidates(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_onboard_organisation_from_xero(uuid, text, text[], text, integer, text, boolean, boolean, boolean, boolean, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_onboard_candidates(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_onboard_organisation_from_xero(uuid, text, text[], text, integer, text, boolean, boolean, boolean, boolean, text[]) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION app_private.tg_xero_pending_onboards_guard() FROM PUBLIC, anon, authenticated;

-- 5. Nightly purge: expired pending records and their token ciphertext.
CREATE OR REPLACE FUNCTION public.purge_expired_security_logs()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_audit_days integer;
  v_login_days integer;
  v_audit_deleted integer := 0;
  v_login_deleted integer := 0;
  v_onboard_deleted integer := 0;
BEGIN
  SELECT audit_retention_days, login_retention_days
    INTO v_audit_days, v_login_days
  FROM public.security_settings WHERE singleton = true;

  v_audit_days := COALESCE(v_audit_days, 730);
  v_login_days := COALESCE(v_login_days, 730);

  DELETE FROM public.audit_log
   WHERE at < now() - make_interval(days => v_audit_days)
     AND action <> 'audit_retention_purge';
  GET DIAGNOSTICS v_audit_deleted = ROW_COUNT;

  DELETE FROM public.login_events
   WHERE occurred_at < now() - make_interval(days => v_login_days);
  GET DIAGNOSTICS v_login_deleted = ROW_COUNT;

  -- Unused "Start from a Xero file" authorisations (30-minute lifetime).
  DELETE FROM public.xero_pending_onboards WHERE expires_at < now();
  GET DIAGNOSTICS v_onboard_deleted = ROW_COUNT;

  IF v_audit_deleted > 0 OR v_login_deleted > 0 THEN
    INSERT INTO public.audit_log (actor_user_id, action, target_type, target_id, meta)
    VALUES (NULL, 'audit_retention_purge', 'system', 'retention',
            jsonb_build_object(
              'audit_rows_deleted', v_audit_deleted,
              'login_rows_deleted', v_login_deleted,
              'audit_retention_days', v_audit_days,
              'login_retention_days', v_login_days));
  END IF;

  RETURN jsonb_build_object('audit_rows_deleted', v_audit_deleted, 'login_rows_deleted', v_login_deleted,
                            'pending_onboards_deleted', v_onboard_deleted);
END;
$function$;