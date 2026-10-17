CREATE OR REPLACE FUNCTION public.client_income_tax_instalment_frequency(_client_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _actor uuid := auth.uid(); _f text;
BEGIN
  PERFORM app_private.assert_aal2();
  -- Shared client read rule (membership, owner, client access, standing access);
  -- previously used has_client_read_access alone, which excluded organisation members.
  IF _actor IS NULL OR _client_id IS NULL OR NOT coalesce(app_private.user_can_read_client(_actor, _client_id), false) THEN
    RAISE EXCEPTION 'CLIENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  SELECT income_tax_instalment_frequency INTO _f FROM public.clients WHERE id = _client_id;
  RETURN _f;
END $function$;
REVOKE ALL ON FUNCTION public.client_income_tax_instalment_frequency(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_income_tax_instalment_frequency(uuid) TO authenticated, service_role;