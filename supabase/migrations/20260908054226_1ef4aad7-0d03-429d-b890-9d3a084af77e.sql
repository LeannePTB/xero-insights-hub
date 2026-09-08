REVOKE EXECUTE ON FUNCTION public.client_removal_impact(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_client(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_removal_impact(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_client(uuid) TO authenticated, service_role;