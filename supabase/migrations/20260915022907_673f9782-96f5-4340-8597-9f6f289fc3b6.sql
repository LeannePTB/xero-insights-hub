-- OUTAGE FIX part 2, 15 Sep 2026. app_private.is_aal2() no longer consults the
-- inactivity check, but assert_aal2() still did — so every server function and
-- definer function kept raising SESSION_IDLE for a session whose only timestamp
-- was its sign-in time. Restored to exactly the pre-idle-work behaviour: MFA is
-- asserted, nothing else. session_activity, touch_session_activity,
-- is_session_active and session_is_active are left in place untouched.
CREATE OR REPLACE FUNCTION app_private.assert_aal2()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if not app_private.is_aal2() then
    raise exception 'MFA_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  return true;
end;
$function$;