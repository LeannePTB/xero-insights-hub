ALTER TABLE public.firms ADD COLUMN IF NOT EXISTS managed_by_traction boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.firms.managed_by_traction IS 'Display only: whether the Traction Advisory team was added at creation. Never used to grant access.';

DROP FUNCTION IF EXISTS public.admin_onboard_organisation_from_xero(uuid, text, text[], text, integer, text, boolean, boolean, boolean, boolean, text[]);

CREATE FUNCTION public.admin_onboard_organisation_from_xero(
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
  _cards text[],
  _add_practice_team boolean DEFAULT true
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

  FOREACH _tenant IN ARRAY _wanted LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p.tenants) t WHERE t->>'tenantId' = _tenant) THEN
      RAISE EXCEPTION 'TENANT_NOT_AUTHORISED' USING errcode = 'insufficient_privilege';
    END IF;
    IF EXISTS (SELECT 1 FROM public.xero_connections c WHERE c.tenant_id = _tenant) THEN
      RAISE EXCEPTION 'TENANT_ALREADY_LINKED' USING errcode = 'unique_violation';
    END IF;
  END LOOP;

  INSERT INTO public.firms (name, is_always_free, owner_user_id, managed_by_traction) VALUES (_name, false, _me, coalesce(_add_practice_team, true)) RETURNING id INTO _firm;
  INSERT INTO public.subscriptions (firm_id, tier, status) VALUES (_firm, 'starter', 'active');
  INSERT INTO public.firm_members (firm_id, user_id, role, status) VALUES (_firm, _me, 'owner', 'active');

  -- Traction Advisory team auto-add only when "Traction Advisory looks after this organisation" is ticked.
  IF coalesce(_add_practice_team, true) THEN
    FOR _member IN SELECT pt.user_id FROM public.practice_team pt WHERE pt.user_id <> _me LOOP
      INSERT INTO public.firm_members (firm_id, user_id, role, status)
        SELECT _firm, _member.user_id, 'staff', 'active'
         WHERE NOT EXISTS (SELECT 1 FROM public.firm_members m WHERE m.firm_id = _firm AND m.user_id = _member.user_id);
      INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
      VALUES (_me, _firm, 'practice_team_member_joined_new_organisation', 'firm', _firm::text,
              jsonb_build_object('firm_id', _firm, 'user_id', _member.user_id, 'role', 'staff'));
    END LOOP;
  END IF;

  PERFORM public.set_org_purchase(_firm, _client_limit, coalesce(_advisory, false), coalesce(_consolidation, false),
                                  coalesce(_branding, false), coalesce(_white_label, false), _billing_mode);
  IF _cards IS NOT NULL THEN
    PERFORM public.set_org_card_defaults(_firm, _cards);
  END IF;

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

  DELETE FROM public.xero_pending_onboards WHERE id = p.id;

  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  VALUES (_me, _firm, 'organisation_created_from_xero', 'firm', _firm::text,
          jsonb_build_object('firm_id', _firm, 'client_count', array_length(_wanted, 1), 'tenant_ids', to_jsonb(_wanted),
                             'client_limit', _client_limit, 'advisory_enabled', coalesce(_advisory,false),
                             'consolidation_enabled', coalesce(_consolidation,false), 'branding_enabled', coalesce(_branding,false),
                             'white_label_enabled', coalesce(_white_label,false), 'billing_mode', _billing_mode,
                             'default_cards', to_jsonb(_cards),
                             'traction_team_added', coalesce(_add_practice_team, true)));

  RETURN QUERY SELECT _firm, _clients, _wanted;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_onboard_organisation_from_xero(uuid, text, text[], text, integer, text, boolean, boolean, boolean, boolean, text[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_onboard_organisation_from_xero(uuid, text, text[], text, integer, text, boolean, boolean, boolean, boolean, text[], boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_viewer_scope(_firm_id uuid, _user_id uuid, _scope text, _client_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
  _valid uuid[];
  _row record;
  _standing uuid;
BEGIN
  PERFORM app_private.assert_aal2();
  IF auth.uid() IS NULL OR NOT app_private.can_manage_client_viewers(auth.uid(), _firm_id) THEN
    RAISE EXCEPTION 'NOT_PERMITTED' USING errcode = 'insufficient_privilege';
  END IF;
  IF _scope NOT IN ('all_clients', 'selected') THEN
    RAISE EXCEPTION 'INVALID_SCOPE' USING errcode = '22023';
  END IF;
  SELECT id INTO _standing FROM public.firm_viewer_access WHERE firm_id = _firm_id AND user_id = _user_id;
  IF _standing IS NULL AND NOT EXISTS (
      SELECT 1 FROM public.client_access ca JOIN public.clients c ON c.id = ca.client_id
       WHERE c.firm_id = _firm_id AND ca.user_id = _user_id AND ca.relationship = 'external_adviser') THEN
    RAISE EXCEPTION 'NOT_A_VIEWER' USING errcode = 'no_data_found';
  END IF;

  IF _scope = 'all_clients' THEN
    IF _standing IS NULL THEN
      PERFORM public.grant_firm_viewer_access(_firm_id, _user_id, 'multi_company'::public.dashboard_tier, NULL);
    END IF;
    FOR _row IN SELECT ca.id FROM public.client_access ca JOIN public.clients c ON c.id = ca.client_id
                 WHERE c.firm_id = _firm_id AND ca.user_id = _user_id AND ca.relationship = 'external_adviser' LOOP
      PERFORM public.revoke_client_access(_row.id);
    END LOOP;
    INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
    VALUES (auth.uid(), _firm_id, 'viewer_scope_changed', 'firm', _firm_id::text,
            jsonb_build_object('user_id', _user_id, 'scope', 'all_clients'));
    RETURN 0;
  END IF;

  SELECT coalesce(array_agg(c.id), '{}') INTO _valid FROM public.clients c
   WHERE c.firm_id = _firm_id AND c.id = ANY(coalesce(_client_ids, '{}'));
  IF array_length(_valid, 1) IS NULL THEN
    RAISE EXCEPTION 'NO_CLIENTS' USING errcode = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.client_access ca WHERE ca.user_id = _user_id AND ca.client_id = ANY(_valid)
              AND ca.relationship IS DISTINCT FROM 'external_adviser') THEN
    RAISE EXCEPTION 'OTHER_RELATIONSHIP' USING errcode = '22023';
  END IF;
  FOR _row IN SELECT unnest(_valid) AS cid LOOP
    PERFORM public.grant_client_access(_row.cid, _user_id, 'multi_company', 'external_adviser'::public.client_access_relationship, NULL);
  END LOOP;
  FOR _row IN SELECT ca.id FROM public.client_access ca JOIN public.clients c ON c.id = ca.client_id
               WHERE c.firm_id = _firm_id AND ca.user_id = _user_id AND ca.relationship = 'external_adviser'
                 AND NOT (ca.client_id = ANY(_valid)) LOOP
    PERFORM public.revoke_client_access(_row.id);
  END LOOP;
  IF _standing IS NOT NULL THEN
    PERFORM public.revoke_firm_viewer_access(_standing);
  END IF;
  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  VALUES (auth.uid(), _firm_id, 'viewer_scope_changed', 'firm', _firm_id::text,
          jsonb_build_object('user_id', _user_id, 'scope', 'selected', 'client_count', array_length(_valid, 1)));
  RETURN array_length(_valid, 1);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.set_viewer_scope(uuid, uuid, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_viewer_scope(uuid, uuid, text, uuid[]) TO authenticated;