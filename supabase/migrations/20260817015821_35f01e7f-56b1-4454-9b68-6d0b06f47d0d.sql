ALTER FUNCTION public.me_is_super_admin() SET SCHEMA app_private;
REVOKE ALL ON FUNCTION app_private.me_is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.me_is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.me_is_super_admin() TO service_role;