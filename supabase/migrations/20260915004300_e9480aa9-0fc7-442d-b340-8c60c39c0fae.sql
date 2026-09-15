-- Caller-scoped read of the server-held activity state. No parameters, so it
-- can only ever report on the caller's own session; returns false when it
-- cannot be verified (fail closed).
CREATE OR REPLACE FUNCTION public.session_is_active()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  select app_private.is_session_active()
$function$;

REVOKE EXECUTE ON FUNCTION public.session_is_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_is_active() TO authenticated;