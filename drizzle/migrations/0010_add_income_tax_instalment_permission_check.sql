CREATE OR REPLACE FUNCTION public.can_manage_client_income_tax_instalments(_client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
BEGIN
  PERFORM app_private.assert_aal2();
  IF _actor IS NULL OR _client_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN app_private.user_can_write_client(_actor, _client_id)
    OR EXISTS (
      SELECT 1 FROM public.client_access ca
      WHERE ca.client_id = _client_id
        AND ca.user_id = _actor
        AND ca.relationship = 'business_owner'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_client_income_tax_instalments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_client_income_tax_instalments(uuid) TO authenticated;