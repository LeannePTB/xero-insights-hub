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
         -- Inactivity timeout (owner decision, 15 Sep 2026): re-enabled once a
         -- real session was proven to record activity and an actively used
         -- session was proven to still be accepted after 30 minutes.
         and app_private.is_session_active()
  end
$function$;

CREATE OR REPLACE FUNCTION app_private.assert_aal2()
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
AS $function$
begin
  -- Idle is not an MFA problem: answer it distinctly and first, so no caller
  -- ever shows an authenticator prompt to someone who was simply away.
  if not app_private.is_session_active() then
    raise exception 'SESSION_IDLE' using errcode = 'insufficient_privilege';
  end if;

  if not app_private.is_aal2() then
    raise exception 'MFA_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  return true;
end;
$function$;