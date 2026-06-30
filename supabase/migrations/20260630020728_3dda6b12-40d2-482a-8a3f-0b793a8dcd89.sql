REVOKE EXECUTE ON FUNCTION public.me_is_super_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.me_is_super_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.me_is_super_admin() TO service_role;