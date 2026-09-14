CREATE OR REPLACE FUNCTION app_private.is_session_fresh()
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE SECURITY DEFINER
  SET search_path TO ''
AS $function$
declare
  _claims jsonb;
  _session_id uuid;
  _signed_in_at timestamptz;
  _now_syd timestamp;
  _cutoff_date date;
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

  -- Most recent 3am Australia/Sydney that has ALREADY passed. Between midnight
  -- and 3am local time that is yesterday's 3am, not today's (which is still in
  -- the future and would make every session stale). AT TIME ZONE interprets the
  -- local timestamp as Sydney wall-clock, so AEST/AEDT is handled by the tz
  -- database.
  _now_syd := timezone('Australia/Sydney', now());
  _cutoff_date := _now_syd::date;
  if _now_syd::time < time '03:00' then
    _cutoff_date := _cutoff_date - 1;
  end if;
  _cutoff := ((_cutoff_date + interval '3 hours') at time zone 'Australia/Sydney');

  return _signed_in_at >= _cutoff;
end;
$function$;

REVOKE ALL ON FUNCTION app_private.is_session_fresh() FROM PUBLIC, anon;