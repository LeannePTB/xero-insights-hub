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

  -- Practice team auto-add, as the manual path (practice_team is keyed on user_id).
  FOR _member IN SELECT pt.user_id FROM public.practice_team pt WHERE pt.user_id <> _me LOOP
    INSERT INTO public.firm_members (firm_id, user_id, role, status)
      SELECT _firm, _member.user_id, 'staff', 'active'
       WHERE NOT EXISTS (SELECT 1 FROM public.firm_members m WHERE m.firm_id = _firm AND m.user_id = _member.user_id);
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