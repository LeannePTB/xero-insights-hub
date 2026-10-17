CREATE OR REPLACE FUNCTION public.save_client_income_tax_instalment(_client_id uuid, _tenant_id text, _period_start date, _period_end date, _amount numeric)
 RETURNS client_income_tax_instalments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _firm_id uuid;
  _old numeric;
  _saved public.client_income_tax_instalments;
BEGIN
  PERFORM app_private.assert_aal2();
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF _client_id IS NULL OR _tenant_id IS NULL OR btrim(_tenant_id) = '' THEN
    RAISE EXCEPTION 'INVALID_CLIENT_OR_XERO_FILE' USING ERRCODE = '22023';
  END IF;
  IF _period_start IS NULL OR _period_end IS NULL OR _period_end < _period_start THEN
    RAISE EXCEPTION 'INVALID_INSTALMENT_PERIOD' USING ERRCODE = '22023';
  END IF;
  IF _amount IS NULL OR _amount < 0 OR _amount > 999999999999.99 OR round(_amount, 2) <> _amount THEN
    RAISE EXCEPTION 'INVALID_INSTALMENT_AMOUNT' USING ERRCODE = '22023';
  END IF;
  IF NOT coalesce(app_private.user_can_write_client(_actor, _client_id), false) THEN
    RAISE EXCEPTION 'CLIENT_INCOME_TAX_INSTALMENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  PERFORM public.assert_tenant_belongs_to_client(_client_id, _tenant_id);
  SELECT c.firm_id INTO _firm_id FROM public.clients c WHERE c.id = _client_id;

  SELECT amount INTO _old FROM public.client_income_tax_instalments
   WHERE client_id = _client_id AND tenant_id = btrim(_tenant_id)
     AND period_start = _period_start AND period_end = _period_end
   FOR UPDATE;

  INSERT INTO public.client_income_tax_instalments (
    client_id, tenant_id, period_start, period_end, amount, created_by, updated_by
  ) VALUES (
    _client_id, btrim(_tenant_id), _period_start, _period_end, _amount, _actor, _actor
  )
  ON CONFLICT (client_id, tenant_id, period_start, period_end)
  DO UPDATE SET amount = EXCLUDED.amount, updated_by = _actor, updated_at = now()
  RETURNING * INTO _saved;

  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  VALUES (_actor, _firm_id, 'client_income_tax_instalment_saved', 'client', _client_id::text,
    jsonb_build_object('tenant_id', btrim(_tenant_id), 'period_start', _period_start, 'period_end', _period_end,
      'old_amount', _old, 'new_amount', _amount));
  RETURN _saved;
END;
$function$;
REVOKE ALL ON FUNCTION public.save_client_income_tax_instalment(uuid, text, date, date, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_client_income_tax_instalment(uuid, text, date, date, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_client_income_tax_instalment(_client_id uuid, _tenant_id text, _period_start date, _period_end date)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _firm_id uuid;
  _old numeric;
BEGIN
  PERFORM app_private.assert_aal2();
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF _client_id IS NULL OR _tenant_id IS NULL OR btrim(_tenant_id) = '' OR _period_start IS NULL OR _period_end IS NULL THEN
    RAISE EXCEPTION 'INVALID_INSTALMENT_PERIOD' USING ERRCODE = '22023';
  END IF;
  IF NOT coalesce(app_private.user_can_write_client(_actor, _client_id), false) THEN
    RAISE EXCEPTION 'CLIENT_INCOME_TAX_INSTALMENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  PERFORM public.assert_tenant_belongs_to_client(_client_id, _tenant_id);
  SELECT c.firm_id INTO _firm_id FROM public.clients c WHERE c.id = _client_id;

  DELETE FROM public.client_income_tax_instalments
   WHERE client_id = _client_id AND tenant_id = btrim(_tenant_id)
     AND period_start = _period_start AND period_end = _period_end
  RETURNING amount INTO _old;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  VALUES (_actor, _firm_id, 'client_income_tax_instalment_cleared', 'client', _client_id::text,
    jsonb_build_object('tenant_id', btrim(_tenant_id), 'period_start', _period_start, 'period_end', _period_end,
      'old_amount', _old, 'new_amount', NULL));
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.clear_client_income_tax_instalment(uuid, text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_client_income_tax_instalment(uuid, text, date, date) TO authenticated;