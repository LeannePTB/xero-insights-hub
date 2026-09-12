create or replace function public.test_accounts_posture()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _running boolean;
  _started timestamptz;
  _unbanned integer;
  _outside integer;
  _platform integer;
  _stale integer;
  _total integer;
  _status text;
  _detail text;
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(running, false), started_at into _running, _started
  from public.security_test_run_state where id;

  select count(*) into _total from public.security_test_accounts;

  select count(*) into _unbanned
  from public.security_test_accounts t
  join auth.users u on u.id = t.user_id
  where u.banned_until is null or u.banned_until <= now();

  -- Organisation-scoped access outside the test organisation only. A
  -- user_roles row is NOT organisation-scoped, so it can never be "outside"
  -- the test organisation; client_viewer on a test account is expected.
  select count(*) into _outside
  from public.security_test_accounts t
  where exists (select 1 from public.firm_members m
                 where m.user_id = t.user_id
                   and m.firm_id is distinct from app_private.security_test_firm_id())
     or exists (select 1 from public.firm_viewer_access v
                 where v.user_id = t.user_id
                   and v.firm_id is distinct from app_private.security_test_firm_id())
     or exists (select 1 from public.client_access a
                 join public.clients c on c.id = a.client_id
                 where a.user_id = t.user_id
                   and c.firm_id is distinct from app_private.security_test_firm_id())
     or exists (select 1 from public.firm_support_access s
                 where s.grantee_user_id = t.user_id
                   and s.firm_id is distinct from app_private.security_test_firm_id());

  -- Platform privilege on a test account is a real finding on its own.
  select count(*) into _platform
  from public.security_test_accounts t
  where exists (select 1 from public.user_roles r
                 where r.user_id = t.user_id
                   and r.role in ('super_admin','advisor'))
     or exists (select 1 from public.practice_team p where p.user_id = t.user_id);

  select count(*) into _stale
  from auth.sessions s
  join public.security_test_accounts t on t.user_id = s.user_id
  where not _running
     or _started is null
     or s.created_at < _started;

  if _total = 0 then
    return jsonb_build_object(
      'id','test_accounts','title','Security test accounts are contained',
      'status','ok',
      'detail','No security test accounts exist yet. They are created by the first access-test run.',
      'evidence','public.security_test_accounts is empty');
  end if;

  if (_unbanned > 0 and not _running) or _outside > 0 or _platform > 0 or _stale > 0 then
    _status := 'action';
  else
    _status := 'ok';
  end if;

  _detail := case
    when _status = 'ok' and _running then _total || ' test account(s); a run is in progress.'
    when _status = 'ok' then _total || ' test account(s), all blocked from signing in and confined to the test organisation.'
    else 'A security test account is not contained: '
         || _unbanned || ' able to sign in outside a run, '
         || _outside || ' with organisation access outside the test organisation, '
         || _platform || ' holding a platform role or practice-team place, '
         || _stale || ' with a session outside the run window.'
  end;

  return jsonb_build_object(
    'id','test_accounts','title','Security test accounts are contained',
    'status', _status,
    'detail', _detail,
    'evidence', 'run in progress: ' || _running || '; unbanned: ' || _unbanned
                || '; organisation access outside the test organisation: ' || _outside
                || '; platform role or practice team: ' || _platform
                || '; sessions outside the run window: ' || _stale);
end
$$;

revoke execute on function public.test_accounts_posture() from public, anon;
grant execute on function public.test_accounts_posture() to authenticated;