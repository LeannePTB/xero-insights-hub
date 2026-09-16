create or replace function public.xero_rate_limit_posture()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  day_cap constant integer := 5000;
  min_cap constant integer := 60;
  app_cap constant integer := 10000;
  burst_cap constant integer := 20;
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
      when bursts > 0 then 'A Xero file made more than ' || burst_cap || ' calls in one hour — check for a refresh loop before it burns that file''s daily quota.'
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
revoke execute on function public.xero_rate_limit_posture() from public, anon;
grant execute on function public.xero_rate_limit_posture() to authenticated;