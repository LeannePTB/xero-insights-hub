-- Session timeout posture: add an activity-coverage alert.
--
-- Owner decision, 15 September 2026. On 15 Sep the recorder was silently broken
-- and NO live session had an activity row; the first signal was people being
-- locked out. This adds that signal to the posture check itself.
--
-- No authorisation change: this function only reports. The enforcement objects
-- (`app_private.is_session_active`, `app_private.is_aal2`, `app_private.assert_aal2`,
-- `public.touch_session_activity`) are untouched.
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

  -- ACTIVITY COVERAGE (added 15 Sep 2026). A live session that is older than the
  -- window and has NO activity record is either a session from before the
  -- recorder was fixed, or the recorder is broken again. Either way the person
  -- will be asked to sign in again, so it must be visible here first.
  select count(*)::int into live_sessions from auth.sessions;
  select count(*)::int,
         coalesce(to_char(max(now() - s.created_at), 'DD"d" HH24"h" MI"m"'), 'none')
    into uncovered, oldest_uncovered
  from auth.sessions s
  left join public.session_activity a on a.session_id = s.id
  where a.session_id is null
    and s.created_at < now() - coalesce(nullif(window_txt, 'not found')::interval, interval '30 minutes');

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
      || '; live sessions past the window with no activity record: ' || uncovered
      || ' (oldest: ' || oldest_uncovered || ')'
      || '; activity timestamps are server-written only (public.session_activity, caller-scoped upsert).');
end;
$function$;

revoke execute on function public.session_controls_posture() from public, anon;
grant execute on function public.session_controls_posture() to authenticated;