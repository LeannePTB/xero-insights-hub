-- Live posture reading for session controls. It reports on the REAL enforcement
-- objects (the activity helper, the freshness helper and the aal2 helper that
-- gates every table), not on configuration copied into TypeScript, so it fails
-- if a future change silently removes the idle check from the gate.
create or replace function public.session_controls_posture()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  src_active text;
  src_aal2 text;
  src_assert text;
  window_txt text;
  has_idle_in_gate boolean;
  has_fresh_in_gate boolean;
  has_idle_code boolean;
  has_touch boolean;
  bad boolean;
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
  has_fresh_in_gate := coalesce(src_aal2, '') like '%is_session_fresh%';
  has_idle_code := coalesce(src_assert, '') like '%SESSION_IDLE%';
  has_touch := exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'touch_session_activity' and p.prosecdef);

  bad := src_active is null or not has_idle_in_gate or not has_fresh_in_gate
         or not has_idle_code or not has_touch or window_txt = 'not found';

  return jsonb_build_object(
    'id', 'session_controls',
    'title', 'Session timeout controls',
    'status', case when bad then 'action' else 'ok' end,
    'detail', case when bad
      then 'Session timeout enforcement is incomplete in the database — see the evidence.'
      else 'Sessions expire after ' || window_txt || ' without activity and again at the daily sign-in cut-off, enforced on every table and every guarded function.'
      end,
    'evidence', 'app_private.is_session_active window: ' || window_txt
      || '; is_aal2 references is_session_active: ' || has_idle_in_gate
      || '; is_aal2 references is_session_fresh: ' || has_fresh_in_gate
      || '; assert_aal2 raises SESSION_IDLE: ' || has_idle_code
      || '; touch_session_activity is a definer function: ' || has_touch
      || '; activity timestamps are server-written only (public.session_activity, caller-scoped upsert).');
end;
$function$;

revoke execute on function public.session_controls_posture() from public;
revoke execute on function public.session_controls_posture() from anon;
grant execute on function public.session_controls_posture() to authenticated;
grant execute on function public.session_controls_posture() to service_role;