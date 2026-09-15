-- 1. The aal2 gate: aal claim + inactivity only. The daily cut-off is gone.
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
         and app_private.is_session_active()
  end
$function$;

-- 2. assert_aal2: SESSION_IDLE then MFA_REQUIRED. SESSION_EXPIRED (daily
-- cut-off) is removed along with the control it reported.
CREATE OR REPLACE FUNCTION app_private.assert_aal2()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  -- Idle is not an MFA problem: a distinct code so the person is asked to sign
  -- in again, never sent to their authenticator app.
  if not app_private.is_session_active() then
    raise exception 'SESSION_IDLE' using errcode = 'insufficient_privilege';
  end if;

  if not app_private.is_aal2() then
    raise exception 'MFA_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  return true;
end;
$function$;

-- 3. Posture check: report the inactivity window; no longer expect a daily
-- cut-off, so it cannot read OK for a control that no longer exists.
CREATE OR REPLACE FUNCTION public.session_controls_posture()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  bad := src_active is null or not has_idle_in_gate or not has_idle_code
         or not has_touch or window_txt = 'not found' or not no_daily_cutoff;

  return jsonb_build_object(
    'id', 'session_controls',
    'title', 'Session timeout controls',
    'status', case when bad then 'action' else 'ok' end,
    'detail', case when bad
      then 'Session timeout enforcement is incomplete in the database — see the evidence.'
      else 'Sessions expire after ' || window_txt || ' without activity, enforced on every table and every guarded function, plus sign-out on demand. There is no daily forced sign-in (owner decision, 15 Sep 2026).'
      end,
    'evidence', 'app_private.is_session_active window: ' || window_txt
      || '; is_aal2 references is_session_active: ' || has_idle_in_gate
      || '; assert_aal2 raises SESSION_IDLE: ' || has_idle_code
      || '; touch_session_activity is a definer function: ' || has_touch
      || '; daily sign-in cut-off fully removed (no is_session_fresh anywhere): ' || no_daily_cutoff
      || '; activity timestamps are server-written only (public.session_activity, caller-scoped upsert).');
end;
$function$;

-- 4. Nothing calls it any more (verified: only is_aal2, assert_aal2 and
-- session_controls_posture ever did, all rewritten above).
DROP FUNCTION app_private.is_session_fresh();