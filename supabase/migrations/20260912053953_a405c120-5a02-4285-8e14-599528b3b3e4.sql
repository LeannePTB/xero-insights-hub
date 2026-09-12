-- ============================================================ 1. test flag
alter table public.firms add column if not exists is_test boolean not null default false;

-- ==================================================== 2. credential storage
create table if not exists public.security_test_accounts (
  user_id uuid primary key,
  label text not null unique check (label in ('owner','staff','viewer')),
  email text not null unique,
  password_enc bytea not null,
  totp_secret_enc bytea,
  factor_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on table public.security_test_accounts from public, anon, authenticated;
grant select, insert, update, delete on table public.security_test_accounts to service_role;
alter table public.security_test_accounts enable row level security;
create policy "test account rows service select" on public.security_test_accounts
  as permissive for select to service_role using (true);
create policy "test account rows service insert" on public.security_test_accounts
  as permissive for insert to service_role with check (true);
create policy "test account rows service update" on public.security_test_accounts
  as permissive for update to service_role using (true) with check (true);
create policy "test account rows service delete" on public.security_test_accounts
  as permissive for delete to service_role using (true);
create policy mfa_aal2_required on public.security_test_accounts
  as restrictive for all to authenticated
  using (app_private.is_aal2()) with check (app_private.is_aal2());

create table if not exists public.security_test_run_state (
  id boolean primary key default true check (id),
  running boolean not null default false,
  run_id uuid,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.security_test_run_state (id, running) values (true, false)
  on conflict (id) do nothing;
revoke all on table public.security_test_run_state from public, anon, authenticated;
grant select, insert, update, delete on table public.security_test_run_state to service_role;
alter table public.security_test_run_state enable row level security;
create policy "test run state service select" on public.security_test_run_state
  as permissive for select to service_role using (true);
create policy "test run state service insert" on public.security_test_run_state
  as permissive for insert to service_role with check (true);
create policy "test run state service update" on public.security_test_run_state
  as permissive for update to service_role using (true) with check (true);
create policy "test run state service delete" on public.security_test_run_state
  as permissive for delete to service_role using (true);
create policy mfa_aal2_required on public.security_test_run_state
  as restrictive for all to authenticated
  using (app_private.is_aal2()) with check (app_private.is_aal2());

-- ================================================= 3. confinement, in the DB
create or replace function app_private.is_security_test_account(_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select _user_id is not null
     and exists (select 1 from public.security_test_accounts t where t.user_id = _user_id)
$$;
revoke execute on function app_private.is_security_test_account(uuid) from public, anon;

create or replace function app_private.security_test_firm_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select f.id from public.firms f where f.is_test order by f.created_at limit 1
$$;
revoke execute on function app_private.security_test_firm_id() from public, anon;

create or replace function app_private.confine_security_test_accounts()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid;
  _firm uuid;
  _test_firm uuid;
begin
  if tg_table_name = 'firms' then
    _uid := new.owner_user_id;
  elsif tg_table_name = 'firm_support_access' then
    _uid := new.grantee_user_id;
  else
    _uid := new.user_id;
  end if;

  if not app_private.is_security_test_account(_uid) then
    return new;
  end if;

  -- A test account may never hold a platform role, a support grant or
  -- practice-team membership anywhere at all.
  if tg_table_name in ('user_roles', 'practice_team', 'firm_support_access') then
    raise exception 'SECURITY_TEST_ACCOUNT_CONFINED' using errcode = 'check_violation';
  end if;

  _test_firm := app_private.security_test_firm_id();

  if tg_table_name = 'firms' then
    if new.is_test then return new; end if;
    raise exception 'SECURITY_TEST_ACCOUNT_CONFINED' using errcode = 'check_violation';
  end if;

  if tg_table_name = 'client_access' then
    select c.firm_id into _firm from public.clients c where c.id = new.client_id;
  else
    _firm := new.firm_id;
  end if;

  if _test_firm is null or _firm is null or _firm <> _test_firm then
    raise exception 'SECURITY_TEST_ACCOUNT_CONFINED' using errcode = 'check_violation';
  end if;
  return new;
end
$$;
revoke execute on function app_private.confine_security_test_accounts() from public, anon;

drop trigger if exists trg_confine_test_accounts on public.firm_members;
create trigger trg_confine_test_accounts before insert or update on public.firm_members
  for each row execute function app_private.confine_security_test_accounts();
drop trigger if exists trg_confine_test_accounts on public.client_access;
create trigger trg_confine_test_accounts before insert or update on public.client_access
  for each row execute function app_private.confine_security_test_accounts();
drop trigger if exists trg_confine_test_accounts on public.firm_viewer_access;
create trigger trg_confine_test_accounts before insert or update on public.firm_viewer_access
  for each row execute function app_private.confine_security_test_accounts();
drop trigger if exists trg_confine_test_accounts on public.firm_support_access;
create trigger trg_confine_test_accounts before insert or update on public.firm_support_access
  for each row execute function app_private.confine_security_test_accounts();
drop trigger if exists trg_confine_test_accounts on public.user_roles;
create trigger trg_confine_test_accounts before insert or update on public.user_roles
  for each row execute function app_private.confine_security_test_accounts();
drop trigger if exists trg_confine_test_accounts on public.practice_team;
create trigger trg_confine_test_accounts before insert or update on public.practice_team
  for each row execute function app_private.confine_security_test_accounts();
drop trigger if exists trg_confine_test_accounts on public.firms;
create trigger trg_confine_test_accounts before insert or update on public.firms
  for each row execute function app_private.confine_security_test_accounts();

-- ==================================================== 4. exclude from views
create or replace view public.admin_firm_overview as
 SELECT f.id AS firm_id,
    f.name AS firm_name,
    f.is_always_free,
    f.created_at AS firm_created_at,
    s.tier,
    s.status,
    s.trial_ends_at,
    s.current_period_end,
    s.cancel_at_period_end,
    COALESCE(xc.connection_count, 0) AS connection_count,
    COALESCE(err.recent_error_count, 0) AS recent_error_count
   FROM firms f
     LEFT JOIN subscriptions s ON s.firm_id = f.id
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS connection_count
           FROM xero_connections c
          WHERE c.firm_id = f.id) xc ON true
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS recent_error_count
           FROM audit_log event
          WHERE event.at >= (now() - '7 days'::interval) AND event.action = 'xero_api_error'::text AND event.firm_id = f.id) err ON true
  WHERE f.is_test = false;

create or replace function public.online_users(_window_minutes integer default 5)
 returns table(user_id uuid, display_name text, email text, is_super_admin boolean, has_mfa boolean, last_seen_at timestamp with time zone)
 language plpgsql stable security definer set search_path to ''
as $function$
BEGIN
  PERFORM app_private.assert_aal2();
  IF NOT app_private.me_is_super_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'insufficient_privilege';
  END IF;
  RETURN QUERY
    SELECT p.user_id,
           pr.display_name,
           u.email::text,
           EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role='super_admin'),
           EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = p.user_id AND f.status='verified'),
           p.last_seen_at
    FROM public.user_presence p
    LEFT JOIN public.profiles pr ON pr.id = p.user_id
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.last_seen_at > now() - make_interval(mins => greatest(1, least(_window_minutes, 60)))
      AND NOT app_private.is_security_test_account(p.user_id)
    ORDER BY p.last_seen_at DESC;
END;
$function$;

-- People counts on the posture card: patch the two auth.users counts in place,
-- failing closed if either anchor is not found exactly.
do $do$
declare
  src text;
  a1 constant text := 'from auth.users u
  where u.deleted_at is null
    and not exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status=''verified'');';
  a2 constant text := 'select count(*) into n2 from auth.users where deleted_at is null;';
begin
  src := pg_get_functiondef('public.security_posture()'::regprocedure);
  if strpos(src, a1) = 0 or strpos(src, a2) = 0 then
    raise exception 'security_posture() anchors not found — refusing to patch';
  end if;
  src := replace(src, a1, 'from auth.users u
  where u.deleted_at is null
    and not app_private.is_security_test_account(u.id)
    and not exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status=''verified'');');
  src := replace(src, a2, 'select count(*) into n2 from auth.users where deleted_at is null and not app_private.is_security_test_account(id);');
  execute src;
end
$do$;