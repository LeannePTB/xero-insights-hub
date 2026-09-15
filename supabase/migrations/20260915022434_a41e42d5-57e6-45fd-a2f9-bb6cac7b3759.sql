-- OUTAGE FIX, 15 Sep 2026. The inactivity requirement inside the aal2 gate is
-- removed so the gate is exactly what it was before the idle work: a signed-in
-- person on aal2 passes. Nothing was recording activity, so the check was
-- refusing active people. session_activity, touch_session_activity,
-- is_session_active and session_is_active are all left in place untouched; only
-- this one call is removed, and it will not be restored until an active session
-- is proven to be accepted after 30 minutes of use.
CREATE OR REPLACE FUNCTION app_private.is_aal2()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case
    -- No HTTP request context: cron, migrations, direct maintenance. These are
    -- system contexts, not a signed-in person.
    when nullif(current_setting('request.jwt.claims', true), '') is null then true
    -- Service role (webhooks, OAuth callback, email queue, nightly refresh)
    -- already bypasses row level security, so MFA is not the control there.
    when coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
           ''
         ) = 'service_role' then true
    else coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal',
           ''
         ) = 'aal2'
  end
$function$;