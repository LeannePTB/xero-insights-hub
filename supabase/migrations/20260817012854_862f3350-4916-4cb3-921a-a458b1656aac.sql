REVOKE EXECUTE ON FUNCTION public.purge_expired_security_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_security_logs() TO service_role;