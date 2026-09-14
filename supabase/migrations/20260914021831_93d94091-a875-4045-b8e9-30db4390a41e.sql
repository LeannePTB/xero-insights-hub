-- Daily session cut-off: after 3am Australia/Sydney, any session created
-- before the most recent 3am is denied at the database layer, exactly like a
-- missing MFA. This extends app_private.assert_aal2(), which every protected
-- policy and definer function already calls, so no policy changes are needed.
--
-- Sign-in time comes from auth.sessions.created_at, matched by the session_id
-- claim present in every Supabase access token. (The token's own iat refreshes
-- hourly and cannot be used.) If the session row is missing, deny (fail closed).
-- System contexts (no HTTP request, or service_role) are unaffected.

create or replace function app_private.assert_aal2()
returns boolean
language plpgsql
stable
set search_path = ''
as $function$
declare
  _claims jsonb;
  _session_id uuid;
  _signed_in_at timestamptz;
  _cutoff timestamptz;
begin
  if not app_private.is_aal2() then
    raise exception 'MFA_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  _claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;

  -- No request context or service role: system context, cut-off does not apply.
  if _claims is null or coalesce(_claims ->> 'role', '') = 'service_role' then
    return true;
  end if;

  _session_id := nullif(_claims ->> 'session_id', '')::uuid;
  if _session_id is null then
    raise exception 'SESSION_EXPIRED' using errcode = 'insufficient_privilege';
  end if;

  select s.created_at into _signed_in_at
  from auth.sessions s
  where s.id = _session_id;

  if _signed_in_at is null then
    raise exception 'SESSION_EXPIRED' using errcode = 'insufficient_privilege';
  end if;

  -- Most recent 3am Australia/Sydney, expressed in UTC. AT TIME ZONE on a
  -- local timestamp interprets it as Sydney wall-clock time, so AEST/AEDT
  -- transitions are handled by the tz database.
  _cutoff := ((timezone('Australia/Sydney', now())::date + interval '3 hours')
              at time zone 'Australia/Sydney');

  if _signed_in_at < _cutoff then
    raise exception 'SESSION_EXPIRED' using errcode = 'insufficient_privilege';
  end if;

  return true;
end;
$function$;

-- Definer-function hygiene: no caller may invoke it beyond existing grants.
revoke execute on function app_private.assert_aal2() from public, anon;