ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS income_tax_instalment_frequency text
  CHECK (income_tax_instalment_frequency IN ('not_required','quarterly','annual'));
COMMENT ON COLUMN public.clients.income_tax_instalment_frequency IS 'NULL = not chosen yet. Written only via set_client_income_tax_instalment_frequency.';

-- Existing history implies instalments are required; nobody is set Not required.
UPDATE public.clients c SET income_tax_instalment_frequency = 'quarterly'
 WHERE c.income_tax_instalment_frequency IS NULL
   AND EXISTS (SELECT 1 FROM public.client_income_tax_instalments i WHERE i.client_id = c.id);

CREATE OR REPLACE FUNCTION public.client_income_tax_instalment_frequency(_client_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor uuid := auth.uid(); _f text;
BEGIN
  PERFORM app_private.assert_aal2();
  IF _actor IS NULL OR _client_id IS NULL OR NOT coalesce(app_private.has_client_read_access(_actor, _client_id), false) THEN
    RAISE EXCEPTION 'CLIENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  SELECT income_tax_instalment_frequency INTO _f FROM public.clients WHERE id = _client_id;
  RETURN _f;
END $$;

CREATE OR REPLACE FUNCTION public.set_client_income_tax_instalment_frequency(_client_id uuid, _frequency text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor uuid := auth.uid(); _firm_id uuid; _old text;
BEGIN
  PERFORM app_private.assert_aal2();
  IF _actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF _client_id IS NULL OR _frequency IS NULL OR _frequency NOT IN ('not_required','quarterly','annual') THEN
    RAISE EXCEPTION 'INVALID_INSTALMENT_FREQUENCY' USING ERRCODE = '22023';
  END IF;
  IF NOT coalesce(app_private.user_can_write_client(_actor, _client_id), false) THEN
    RAISE EXCEPTION 'CLIENT_INCOME_TAX_INSTALMENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT firm_id, income_tax_instalment_frequency INTO _firm_id, _old FROM public.clients WHERE id = _client_id FOR UPDATE;
  UPDATE public.clients SET income_tax_instalment_frequency = _frequency WHERE id = _client_id;
  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  VALUES (_actor, _firm_id, 'client_income_tax_instalment_frequency_set', 'client', _client_id::text,
          jsonb_build_object('from', _old, 'to', _frequency));
  RETURN _frequency;
END $$;

REVOKE EXECUTE ON FUNCTION public.client_income_tax_instalment_frequency(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_client_income_tax_instalment_frequency(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_income_tax_instalment_frequency(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_client_income_tax_instalment_frequency(uuid, text) TO authenticated;