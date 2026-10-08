-- Client overview hide/restore toggles, plus two posture-check false-positive fixes.
-- Records changes applied live on 8 Oct 2026 (idempotent re-application).
--
-- 1. clients.overview_hidden / firms.overview_hidden: hide a client or a whole
--    organisation from the client overview. A narrowing only — hidden rows are
--    excluded from overview_clients(), never granted to anyone new.
-- 2. set_client_overview_hidden / set_firm_overview_hidden: the only write path.
--    aal2, write predicates (never read predicates), audited.
-- 3. overview_hidden_items: caller-scoped list of hidden rows the caller could
--    bring back (SECURITY INVOKER; RLS and the write predicates scope it).
-- 4. xero_rate_limit_posture: burst trip point 20 -> 40 calls/hour. The nightly
--    refresh budget is 25 calls per file, so a normal scheduled run tripped the
--    old threshold every night (false positive). 40 is above the budget, so only
--    a genuine refresh loop trips it.
-- 5. session_controls_posture: the no-activity-record count now only includes
--    sessions refreshed in the last 24h. Abandoned sessions (no refresh in 24h)
--    have no open browser, will never be asked to sign in, and made the check
--    cry wolf (a 24-day-old session predating the 15 Sep recorder fix).

alter table public.clients add column if not exists overview_hidden boolean not null default false;
alter table public.firms add column if not exists overview_hidden boolean not null default false;

create or replace function public.overview_clients()
 returns table(client_id uuid, client_name text, firm_id uuid, firm_name text)
 language plpgsql
 stable
 set search_path to 'public'
as $function$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then
    return;
  end if;
  return query
    select c.id, c.name, f.id, f.name
      from public.clients c
      join public.firms f on f.id = c.firm_id
     where app_private.is_practice_member_of(auth.uid(), c.firm_id)
       and app_private.user_can_read_client(auth.uid(), c.id)
       and not c.overview_hidden
       and not f.overview_hidden
     order by f.name, c.name
     limit 1000;
end;
$function$;

create or replace function public.set_client_overview_hidden(_client_id uuid, _hidden boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform app_private.assert_aal2();
  if not app_private.user_can_write_client(auth.uid(), _client_id) then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  update public.clients set overview_hidden = _hidden where id = _client_id;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'client_overview_hidden_set', 'client', _client_id::text,
          jsonb_build_object('hidden', _hidden));
end;
$function$;

create or replace function public.set_firm_overview_hidden(_firm_id uuid, _hidden boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform app_private.assert_aal2();
  if not app_private.user_can_write_firm(auth.uid(), _firm_id) then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  update public.firms set overview_hidden = _hidden where id = _firm_id;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'firm_overview_hidden_set', 'firm', _firm_id::text,
          jsonb_build_object('hidden', _hidden));
end;
$function$;

revoke all on function public.set_client_overview_hidden(uuid, boolean) from public, anon;
revoke all on function public.set_firm_overview_hidden(uuid, boolean) from public, anon;
grant execute on function public.set_client_overview_hidden(uuid, boolean) to authenticated;
grant execute on function public.set_firm_overview_hidden(uuid, boolean) to authenticated;

create or replace function public.overview_hidden_items()
 returns table(kind text, id uuid, name text, firm_id uuid, firm_name text)
 language plpgsql
 stable
 set search_path to 'public'
as $function$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then
    return;
  end if;
  return query
    select 'client'::text, c.id, c.name, f.id, f.name
      from public.clients c
      join public.firms f on f.id = c.firm_id
     where c.overview_hidden
       and not f.overview_hidden
       and app_private.user_can_write_client(auth.uid(), c.id)
    union all
    select 'organisation'::text, f.id, f.name, f.id, f.name
      from public.firms f
     where f.overview_hidden
       and app_private.user_can_write_firm(auth.uid(), f.id)
     order by 5, 3
     limit 1000;
end;
$function$;

revoke all on function public.overview_hidden_items() from public, anon;
grant execute on function public.overview_hidden_items() to authenticated;

create or replace function public.xero_rate_limit_posture()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  day_cap constant integer := 5000;
  min_cap constant integer := 60;
  app_cap constant integer := 10000;
  -- Above the nightly refresh budget (25 calls/file), so a normal scheduled
  -- run never trips this; only a genuine loop does.
  burst_cap constant integer := 40;
  win_from date := (now() at time zone 'utc')::date - 1;
  latest_day date;
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
  select max(day) into latest_day from public.xero_rate_limits where day >= win_from;
  select count(*)::int into files from public.xero_rate_limits where day = latest_day;
  select s.pct, s.txt into worst_pct, worst_txt
  from (
    select least(
             coalesce(r.day_remaining_low::numeric / day_cap, 1),
             coalesce(r.min_remaining_low::numeric / min_cap, 1),
             coalesce(r.app_min_remaining_low::numeric / app_cap, 1)
           ) * 100 as pct,
           coalesce(r.tenant_name, r.tenant_id) || ': day '
             || coalesce(r.day_remaining_low::text, '—') || '/' || day_cap
             || ', minute ' || coalesce(r.min_remaining_low::text, '—') || '/' || min_cap
             || ', app-wide minute ' || coalesce(r.app_min_remaining_low::text, '—') || '/' || app_cap
             || ' (lowest at ' || coalesce(to_char(r.day_low_at, 'DD Mon HH24:MI'), '—') || ' UTC)' as txt
    from public.xero_rate_limits r
    where r.day = latest_day
  ) s order by s.pct asc limit 1;
  select count(*)::int,
         coalesce(string_agg(coalesce(tenant_name, tenant_id) || ' × ' || rate_limited_count
           || ' (' || coalesce(last_problem, 'unknown') || ' limit, last '
           || to_char(last_rate_limited_at, 'DD Mon HH24:MI') || ' UTC)', '; '), 'none')
    into rejects, reject_txt
  from public.xero_rate_limits
  where rate_limited_count > 0 and last_rate_limited_at > now() - interval '24 hours';
  select count(*)::int,
         coalesce(string_agg(coalesce(tenant_name, tenant_id) || ': ' || peak_hour_calls
           || ' calls in the hour from ' || to_char(peak_hour_start, 'DD Mon HH24:MI') || ' UTC', '; '), 'none')
    into bursts, burst_txt
  from public.xero_rate_limits
  where peak_hour_calls > burst_cap and day >= win_from;
  st := case
    when bursts > 0 or rejects > 0 or (worst_pct is not null and worst_pct < 5) then 'action'
    when worst_pct is not null and worst_pct < 20 then 'warn'
    else 'ok'
  end;
  return jsonb_build_object(
    'id', 'xero_rate_limits',
    'title', 'Xero API usage against the limits',
    'status', st,
    'detail', case
      when bursts > 0 then 'A Xero file made more than ' || burst_cap || ' calls in one hour — beyond even the nightly refresh budget, so check for a refresh loop before it burns that file''s daily quota.'
      when rejects > 0 then 'Xero rejected calls for going too fast in the last 24 hours. The figures below name the file.'
      when worst_pct is not null and worst_pct < 5 then 'A Xero file is nearly out of quota. Reads for that file will start failing.'
      when worst_pct is not null and worst_pct < 20 then 'A Xero file is using most of its quota. No failures yet.'
      when latest_day is null then 'No Xero calls recorded today or yesterday, so there is nothing near a limit.'
      else 'Every connected Xero file is well inside its limits.'
    end,
    'evidence', 'most recent day with usage recorded: '
      || coalesce(to_char(latest_day, 'DD Mon YYYY'), 'none in the last 2 days')
      || '; files with usage on that day: ' || files
      || '; lowest remaining on any limit: '
      || case when worst_pct is null then 'no figures yet' else round(worst_pct, 1) || '% — ' || worst_txt end
      || '; rate-limit rejections in the last 24h: ' || rejects || ' — ' || reject_txt
      || '; files over ' || burst_cap || ' calls in one hour (today or yesterday): ' || bursts || ' — ' || burst_txt
      || '; quotas read from Xero''s own X-DayLimit-Remaining / X-MinLimit-Remaining / X-AppMinLimit-Remaining headers, never counted locally.'
  );
end;
$function$;

create or replace function public.session_controls_posture()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  src_active text;
  src_aal2 text;
  src_assert text;
  window_txt text;
  has_idle_in_gate boolean;
  no_daily_cutoff boolean;
  has_idle_code boolean;
  has_touch boolean;
  bad boolean;
  uncovered integer;
  oldest_uncovered text;
  live_sessions integer;
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;

  select p.prosrc into src_active from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private' and p.proname = 'is_session_active';
  select p.prosrc into src_aal2 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private' and p.proname = 'is_aal2';
  select p.prosrc into src_assert from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private' and p.proname = 'assert_aal2';

  window_txt := coalesce((regexp_match(coalesce(src_active,''), 'interval\s+''([^'']+)'''))[1], 'not found');
  has_idle_in_gate := coalesce(src_aal2, '') like '%is_session_active%';
  -- The daily sign-in cut-off was removed on 15 Sep 2026 (owner decision): the
  -- inactivity timeout addresses the stolen-device threat directly. Assert the
  -- removal is complete rather than silently tolerating a half-removed rule.
  no_daily_cutoff := coalesce(src_aal2, '') not like '%is_session_fresh%'
    and coalesce(src_assert, '') not like '%is_session_fresh%'
    and not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app_private' and p.proname = 'is_session_fresh');
  has_idle_code := coalesce(src_assert, '') like '%SESSION_IDLE%';
  has_touch := exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'touch_session_activity' and p.prosecdef);

  -- ACTIVITY COVERAGE (added 15 Sep 2026; narrowed 8 Oct 2026). A live session
  -- that is older than the window, still actively refreshing, and has NO
  -- activity record is the broken-recorder signal: that person WILL be asked
  -- to sign in again. Sessions not refreshed in 24h are abandoned (no open
  -- browser) and are excluded — they made this check cry wolf.
  select count(*)::int into live_sessions from auth.sessions;
  select count(*)::int,
         coalesce(to_char(max(now() - s.created_at), 'DD"d" HH24"h" MI"m"'), 'none')
    into uncovered, oldest_uncovered
  from auth.sessions s
  left join public.session_activity a on a.session_id = s.id
  where a.session_id is null
    and s.created_at < now() - coalesce(nullif(window_txt, 'not found')::interval, interval '30 minutes')
    and s.updated_at > now() - interval '24 hours';

  bad := src_active is null or not has_idle_in_gate or not has_idle_code
         or not has_touch or window_txt = 'not found' or not no_daily_cutoff;

  return jsonb_build_object(
    'id', 'session_controls',
    'title', 'Session timeout controls',
    'status', case when bad then 'action' when uncovered > 0 then 'warn' else 'ok' end,
    'detail', case
      when bad
        then 'Session timeout enforcement is incomplete in the database — see the evidence.'
      when uncovered > 0
        then uncovered || ' of ' || live_sessions || ' live session(s) are past the '
             || window_txt || ' window with no activity record, so those people will be asked to sign in again. '
             || 'One or two after a release is expected; a rising count means activity is not being recorded.'
      else 'Sessions expire after ' || window_txt || ' without activity, enforced on every table and every guarded function, plus sign-out on demand. There is no daily forced sign-in (owner decision, 15 Sep 2026).'
      end,
    'evidence', 'app_private.is_session_active window: ' || window_txt
      || '; is_aal2 references is_session_active: ' || has_idle_in_gate
      || '; assert_aal2 raises SESSION_IDLE: ' || has_idle_code
      || '; touch_session_activity is a definer function: ' || has_touch
      || '; daily sign-in cut-off fully removed (no is_session_fresh anywhere): ' || no_daily_cutoff
      || '; live sessions: ' || live_sessions
      || '; active sessions (refreshed in last 24h) past the window with no activity record: ' || uncovered
      || ' (oldest: ' || oldest_uncovered || ')'
      || '; activity timestamps are server-written only (public.session_activity, caller-scoped upsert).');
end;
$function$;