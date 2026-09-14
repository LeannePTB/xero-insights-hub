-- Daily sign-in cut-off helper. SECURITY DEFINER because auth.sessions is not
-- readable by the authenticated role and this is called from invoker contexts
-- (RESTRICTIVE table policies via app_private.is_aal2()).
-- Fails closed: an unverifiable session is stale.
create or replace function app_private.is_session_fresh()
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  _claims jsonb;
  _session_id uuid;
  _signed_in_at timestamptz;
  _cutoff timestamptz;
begin
  _claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;

  -- No request context (cron, migrations, maintenance) or service role
  -- (webhooks, OAuth callback, email queue): system contexts, not a person.
  if _claims is null or coalesce(_claims ->> 'role', '') = 'service_role' then
    return true;
  end if;

  _session_id := nullif(_claims ->> 'session_id', '')::uuid;
  if _session_id is null then
    return false;
  end if;

  select s.created_at into _signed_in_at
  from auth.sessions s
  where s.id = _session_id;

  if _signed_in_at is null then
    return false;
  end if;

  -- Most recent 3am Australia/Sydney, in UTC. AT TIME ZONE interprets the
  -- local timestamp as Sydney wall-clock, so AEST/AEDT is handled by the tz
  -- database.
  _cutoff := ((timezone('Australia/Sydney', now())::date + interval '3 hours')
              at time zone 'Australia/Sydney');

  return _signed_in_at >= _cutoff;
end;
$$;

revoke execute on function app_private.is_session_fresh() from public;
grant execute on function app_private.is_session_fresh() to authenticated, service_role;

-- Table policies: aal2 now also means "signed in since the cut-off".
create or replace function app_private.is_aal2()
returns boolean
language sql
stable
set search_path to ''
as $$
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
         and app_private.is_session_fresh()
  end
$$;

-- Server-side checks: report the accurate reason, cut-off first.
create or replace function app_private.assert_aal2()
returns boolean
language plpgsql
stable
set search_path to ''
as $$
begin
  if not app_private.is_session_fresh() then
    raise exception 'SESSION_EXPIRED' using errcode = 'insufficient_privilege';
  end if;

  if not app_private.is_aal2() then
    raise exception 'MFA_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  return true;
end;
$$;
