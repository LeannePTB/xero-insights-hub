-- Xero rate-limit telemetry. Shaped on public.xero_api_errors: one row per Xero
-- file per UTC day, updated in place, pruned on write, never in audit_log.
create table public.xero_rate_limits (
  tenant_id text not null,
  day date not null,
  firm_id uuid references public.firms(id) on delete set null,
  xero_connection_id uuid references public.xero_connections(id) on delete set null,
  tenant_name text,
  -- Lowest remaining Xero itself reported, and when. We never count calls
  -- against the quota ourselves: our own counter would drift from Xero's.
  day_remaining_low integer,
  day_low_at timestamptz,
  min_remaining_low integer,
  min_low_at timestamptz,
  app_min_remaining_low integer,
  app_min_low_at timestamptz,
  calls_observed integer not null default 0,
  rate_limited_count integer not null default 0,
  last_problem text,
  last_retry_after_seconds integer,
  last_rate_limited_at timestamptz,
  -- Burst detection: the hour currently being counted, plus the worst hour today.
  hour_start timestamptz,
  hour_calls integer not null default 0,
  peak_hour_calls integer not null default 0,
  peak_hour_start timestamptz,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (tenant_id, day)
);

revoke all on public.xero_rate_limits from anon;
revoke all on public.xero_rate_limits from authenticated;
grant select on public.xero_rate_limits to authenticated;
grant all on public.xero_rate_limits to service_role;

alter table public.xero_rate_limits enable row level security;

-- Restrictive aal2 guard, same shape as every other data table.
create policy mfa_aal2_required on public.xero_rate_limits
  as restrictive for all to authenticated
  using (app_private.is_aal2()) with check (app_private.is_aal2());

-- Path C platform metadata: super admin only. No organisation-scoped read —
-- this is our own API usage, not the organisation's data.
create policy "read xero rate limits as super admin" on public.xero_rate_limits
  for select to authenticated
  using (app_private.is_super_admin(auth.uid()));

-- Deliberately no INSERT/UPDATE/DELETE policy: the only write path is the
-- definer function below, called with the service role from the server.

create index xero_rate_limits_day_idx on public.xero_rate_limits (day desc);

create or replace function public.log_xero_rate_limit(
  _firm_id uuid,
  _connection_id uuid,
  _tenant_id text,
  _tenant_name text,
  _day_remaining integer,
  _min_remaining integer,
  _app_min_remaining integer,
  _rate_limited boolean,
  _problem text,
  _retry_after integer
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _d date := (now() at time zone 'utc')::date;
  _hour timestamptz := date_trunc('hour', now());
  _prob text := left(coalesce(_problem, ''), 20);
begin
  if _tenant_id is null or _tenant_id = '' then return; end if;

  insert into public.xero_rate_limits as t (
    tenant_id, day, firm_id, xero_connection_id, tenant_name,
    day_remaining_low, day_low_at, min_remaining_low, min_low_at,
    app_min_remaining_low, app_min_low_at,
    calls_observed, rate_limited_count,
    last_problem, last_retry_after_seconds, last_rate_limited_at,
    hour_start, hour_calls, peak_hour_calls, peak_hour_start
  ) values (
    _tenant_id, _d, _firm_id, _connection_id, _tenant_name,
    _day_remaining, case when _day_remaining is not null then now() end,
    _min_remaining, case when _min_remaining is not null then now() end,
    _app_min_remaining, case when _app_min_remaining is not null then now() end,
    1, case when coalesce(_rate_limited, false) then 1 else 0 end,
    nullif(_prob, ''), _retry_after,
    case when coalesce(_rate_limited, false) then now() end,
    _hour, 1, 1, _hour
  )
  on conflict (tenant_id, day) do update set
    firm_id = coalesce(excluded.firm_id, t.firm_id),
    xero_connection_id = coalesce(excluded.xero_connection_id, t.xero_connection_id),
    tenant_name = coalesce(excluded.tenant_name, t.tenant_name),
    day_remaining_low = least(coalesce(t.day_remaining_low, _day_remaining), coalesce(_day_remaining, t.day_remaining_low)),
    day_low_at = case
      when _day_remaining is not null
       and (t.day_remaining_low is null or _day_remaining < t.day_remaining_low)
      then now() else t.day_low_at end,
    min_remaining_low = least(coalesce(t.min_remaining_low, _min_remaining), coalesce(_min_remaining, t.min_remaining_low)),
    min_low_at = case
      when _min_remaining is not null
       and (t.min_remaining_low is null or _min_remaining < t.min_remaining_low)
      then now() else t.min_low_at end,
    app_min_remaining_low = least(coalesce(t.app_min_remaining_low, _app_min_remaining), coalesce(_app_min_remaining, t.app_min_remaining_low)),
    app_min_low_at = case
      when _app_min_remaining is not null
       and (t.app_min_remaining_low is null or _app_min_remaining < t.app_min_remaining_low)
      then now() else t.app_min_low_at end,
    calls_observed = t.calls_observed + 1,
    rate_limited_count = t.rate_limited_count + case when coalesce(_rate_limited, false) then 1 else 0 end,
    last_problem = case when coalesce(_rate_limited, false) then nullif(_prob, '') else t.last_problem end,
    last_retry_after_seconds = case when coalesce(_rate_limited, false) then _retry_after else t.last_retry_after_seconds end,
    last_rate_limited_at = case when coalesce(_rate_limited, false) then now() else t.last_rate_limited_at end,
    hour_start = _hour,
    hour_calls = case when t.hour_start = _hour then t.hour_calls + 1 else 1 end,
    peak_hour_calls = greatest(t.peak_hour_calls, case when t.hour_start = _hour then t.hour_calls + 1 else 1 end),
    peak_hour_start = case
      when (case when t.hour_start = _hour then t.hour_calls + 1 else 1 end) > t.peak_hour_calls
      then _hour else t.peak_hour_start end,
    last_seen = now();

  -- Retention, enforced on write so it needs no scheduler.
  delete from public.xero_rate_limits where day < ((now() at time zone 'utc')::date - 30);
end
$$;

revoke all on function public.log_xero_rate_limit(uuid, uuid, text, text, integer, integer, integer, boolean, text, integer) from public;
revoke all on function public.log_xero_rate_limit(uuid, uuid, text, text, integer, integer, integer, boolean, text, integer) from anon;
revoke all on function public.log_xero_rate_limit(uuid, uuid, text, text, integer, integer, integer, boolean, text, integer) from authenticated;

-- Path C read: platform metadata, super admin only, aal2 first.
create or replace function public.xero_rate_limit_usage()
returns table(
  tenant_id text,
  tenant_name text,
  organisation text,
  day date,
  day_remaining_low integer,
  min_remaining_low integer,
  app_min_remaining_low integer,
  calls_observed integer,
  rate_limited_count integer,
  last_problem text,
  last_rate_limited_at timestamptz,
  peak_hour_calls integer,
  peak_hour_start timestamptz,
  last_seen timestamptz
)
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;

  return query
    select r.tenant_id, r.tenant_name, coalesce(f.name, 'Unattributed'), r.day,
           r.day_remaining_low, r.min_remaining_low, r.app_min_remaining_low,
           r.calls_observed, r.rate_limited_count, r.last_problem, r.last_rate_limited_at,
           r.peak_hour_calls, r.peak_hour_start, r.last_seen
    from public.xero_rate_limits r
    left join public.firms f on f.id = r.firm_id
    where r.day >= (now() at time zone 'utc')::date - 1
    order by r.day desc, coalesce(r.day_remaining_low, 999999) asc;
end;
$$;

revoke all on function public.xero_rate_limit_usage() from public;
revoke all on function public.xero_rate_limit_usage() from anon;

create or replace function public.xero_rate_limit_posture()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  -- Xero's published per-tenant limits (5,000/day, 60/minute) and app-wide
  -- minute limit (10,000). Used only to turn a remaining count into a
  -- percentage; every figure below is read from the table, none is assumed.
  day_cap constant integer := 5000;
  min_cap constant integer := 60;
  app_cap constant integer := 10000;
  -- Burst threshold: 300 calls for one file in one hour is ~6% of that file's
  -- daily quota in an hour and only 5 calls a minute, so it cannot itself trip
  -- Xero's minute cap. Real use is ~130 grouped reads a day across 12 files.
  burst_cap constant integer := 300;
  files integer;
  worst_pct numeric;
  worst_txt text := 'none';
  rejects integer;
  reject_txt text := 'none';
  burst_txt text := 'none';
  bursts integer;
  st text;
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;

  select count(*)::int into files
  from public.xero_rate_limits
  where day >= (now() at time zone 'utc')::date;

  select min(pct), min(txt) into worst_pct, worst_txt
  from (
    select least(
             coalesce(r.day_remaining_low::numeric / day_cap, 1),
             coalesce(r.min_remaining_low::numeric / min_cap, 1),
             coalesce(r.app_min_remaining_low::numeric / app_cap, 1)
           ) * 100 as pct,
           coalesce(r.tenant_name, r.tenant_id) || ': day '
             || coalesce(r.day_remaining_low::text, '—') || '/' || day_cap
             || ', minute ' || coalesce(r.min_remaining_low::text, '—') || '/' || min_cap
             || ' (lowest at ' || coalesce(to_char(r.day_low_at, 'HH24:MI'), '—') || ' UTC)' as txt
    from public.xero_rate_limits r
    where r.day >= (now() at time zone 'utc')::date
  ) s;

  select count(*)::int,
         coalesce(string_agg(coalesce(tenant_name, tenant_id) || ' × ' || rate_limited_count
                             || ' (' || coalesce(last_problem, 'unknown') || ' limit, last '
                             || to_char(last_rate_limited_at, 'DD Mon HH24:MI') || ' UTC)', '; '), 'none')
    into rejects, reject_txt
  from public.xero_rate_limits
  where rate_limited_count > 0 and last_rate_limited_at > now() - interval '24 hours';

  select count(*)::int,
         coalesce(string_agg(coalesce(tenant_name, tenant_id) || ': ' || peak_hour_calls
                             || ' calls in the hour from '
                             || to_char(peak_hour_start, 'DD Mon HH24:MI') || ' UTC', '; '), 'none')
    into bursts, burst_txt
  from public.xero_rate_limits
  where peak_hour_calls > burst_cap and day >= (now() at time zone 'utc')::date - 1;

  st := case
    when bursts > 0 or rejects > 0 or (worst_pct is not null and worst_pct < 5) then 'action'
    when worst_pct is not null and worst_pct < 20 then 'warn'
    else 'ok' end;

  return jsonb_build_object(
    'id', 'xero_rate_limits',
    'title', 'Xero API usage against the limits',
    'status', st,
    'detail', case
      when bursts > 0 then 'A Xero file made more than ' || burst_cap
        || ' calls in one hour — check for a refresh loop before it burns that file''s daily quota.'
      when rejects > 0 then 'Xero rejected calls for going too fast in the last 24 hours. The figures below name the file.'
      when worst_pct is not null and worst_pct < 5 then 'A Xero file is nearly out of quota. Reads for that file will start failing.'
      when worst_pct is not null and worst_pct < 20 then 'A Xero file is using most of its quota. No failures yet.'
      when files = 0 then 'No Xero calls recorded today, so there is nothing near a limit.'
      else 'Every connected Xero file is well inside its limits.'
      end,
    'evidence', 'files with usage recorded today: ' || files
      || '; lowest remaining on any limit: '
      || case when worst_pct is null then 'no figures yet' else round(worst_pct, 1) || '% — ' || worst_txt end
      || '; rate-limit rejections in the last 24h: ' || rejects || ' — ' || reject_txt
      || '; files over ' || burst_cap || ' calls in one hour (today or yesterday): ' || bursts || ' — ' || burst_txt
      || '; quotas read from Xero''s own X-DayLimit-Remaining / X-MinLimit-Remaining / X-AppMinLimit-Remaining headers, never counted locally.');
end;
$$;

revoke all on function public.xero_rate_limit_posture() from public;
revoke all on function public.xero_rate_limit_posture() from anon;