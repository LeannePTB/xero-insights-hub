-- Phase 4 batch 3 — super admin / Path C: one rulebook, in the database.

create or replace function public.assert_super_admin()
returns void
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'Forbidden';
  end if;
end;
$$;

create or replace function public.admin_list_advisors()
returns table(id uuid, user_id uuid, created_at timestamptz, email text, display_name text, is_super_admin boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  if not exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'advisor') then
    raise exception 'Only advisors can manage advisors.';
  end if;
  return query
    select ur.id, ur.user_id, ur.created_at,
           u.email::text,
           p.display_name,
           exists (select 1 from public.user_roles s where s.user_id = ur.user_id and s.role = 'super_admin')
    from public.user_roles ur
    left join auth.users u on u.id = ur.user_id
    left join public.profiles p on p.id = ur.user_id
    where ur.role = 'advisor'
    order by ur.created_at;
end;
$$;

create or replace function public.admin_advisor_user_ids()
returns table(user_id uuid)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  if not exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'advisor') then
    raise exception 'Only advisors can manage advisors.';
  end if;
  return query select ur.user_id from public.user_roles ur where ur.role = 'advisor';
end;
$$;

create or replace function public.admin_set_super_admin(_user_id uuid, _make boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.assert_super_admin();
  if _make then
    insert into public.user_roles (user_id, role) values (_user_id, 'super_admin')
    on conflict (user_id, role) do nothing;
    return true;
  end if;
  if _user_id = auth.uid() then
    raise exception 'You can''t remove your own super admin access.';
  end if;
  if not exists (
    select 1 from public.user_roles r where r.role = 'super_admin' and r.user_id <> _user_id
  ) then
    raise exception 'At least one super admin must remain.';
  end if;
  delete from public.user_roles r where r.user_id = _user_id and r.role = 'super_admin';
  return false;
end;
$$;

create or replace function public.admin_grant_advisor(_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  if not exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'advisor') then
    raise exception 'Only advisors can manage advisors.';
  end if;
  insert into public.user_roles (user_id, role) values (_user_id, 'advisor')
  on conflict (user_id, role) do nothing;
  delete from public.user_roles r where r.user_id = _user_id and r.role = 'client_viewer';
end;
$$;

create or replace function public.admin_remove_advisor(_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  if not exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'advisor') then
    raise exception 'Only advisors can manage advisors.';
  end if;
  if not exists (
    select 1 from public.user_roles r where r.role = 'advisor' and r.user_id <> _user_id
  ) then
    raise exception 'At least one advisor must remain.';
  end if;
  delete from public.user_roles r where r.user_id = _user_id;
  delete from public.client_access ca where ca.user_id = _user_id;
end;
$$;

create or replace function public.organisation_members(_firm_id uuid)
returns table(user_id uuid, role text, status text, email text, display_name text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  if not exists (
    select 1 from public.firm_members fm
    where fm.firm_id = _firm_id and fm.user_id = auth.uid() and fm.status = 'active'
  ) then
    raise exception 'You are not a member of this organisation.';
  end if;
  return query
    select fm.user_id, fm.role::text, fm.status,
           u.email::text, p.display_name
    from public.firm_members fm
    left join auth.users u on u.id = fm.user_id
    left join public.profiles p on p.id = fm.user_id
    where fm.firm_id = _firm_id and fm.status = 'active';
end;
$$;

create or replace function public.admin_firm_members(_firm_id uuid)
returns table(id uuid, user_id uuid, role text, status text, created_at timestamptz, email text, display_name text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  perform public.assert_super_admin();
  return query
    select fm.id, fm.user_id, fm.role::text, fm.status, fm.created_at,
           u.email::text, p.display_name
    from public.firm_members fm
    left join auth.users u on u.id = fm.user_id
    left join public.profiles p on p.id = fm.user_id
    where fm.firm_id = _firm_id
    order by fm.created_at;
end;
$$;

create or replace function public.plan_level_usage_count(_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_scope text;
  v_key text;
  v_count integer;
begin
  perform public.assert_super_admin();
  select pl.scope, pl.key into v_scope, v_key from public.plan_levels pl where pl.id = _id;
  if v_scope is null then
    raise exception 'Level not found.';
  end if;
  if v_scope = 'firm' then
    select count(*) into v_count from public.subscriptions s where s.tier = v_key;
  else
    select count(*) into v_count from public.client_access ca where ca.tier = v_key;
  end if;
  return coalesce(v_count, 0);
end;
$$;

revoke execute on function
  public.assert_super_admin(),
  public.admin_list_advisors(),
  public.admin_advisor_user_ids(),
  public.admin_set_super_admin(uuid, boolean),
  public.admin_grant_advisor(uuid),
  public.admin_remove_advisor(uuid),
  public.organisation_members(uuid),
  public.admin_firm_members(uuid),
  public.plan_level_usage_count(uuid)
from public, anon;

grant execute on function
  public.assert_super_admin(),
  public.admin_list_advisors(),
  public.admin_advisor_user_ids(),
  public.admin_set_super_admin(uuid, boolean),
  public.admin_grant_advisor(uuid),
  public.admin_remove_advisor(uuid),
  public.organisation_members(uuid),
  public.admin_firm_members(uuid),
  public.plan_level_usage_count(uuid)
to authenticated, service_role;
