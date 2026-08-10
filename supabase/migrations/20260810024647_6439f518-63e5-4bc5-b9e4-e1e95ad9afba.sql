REVOKE ALL ON FUNCTION public.enforce_client_xero_org_allowance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_client_max_xero_orgs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_client_xero_org_allowance() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_client_max_xero_orgs() TO service_role;