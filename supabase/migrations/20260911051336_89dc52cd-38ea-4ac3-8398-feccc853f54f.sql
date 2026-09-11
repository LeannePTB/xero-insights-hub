-- 1. Generic audit trigger for platform-operations tables (backlog 29).
create or replace function public.audit_table_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  _old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  _new jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  _changed jsonb := '{}'::jsonb;
  _k text;
  _firm uuid;
  _rowid text;
begin
  for _k in
    select key from jsonb_each(_old)
    union
    select key from jsonb_each(_new)
  loop
    if (_old -> _k) is distinct from (_new -> _k) then
      _changed := _changed || jsonb_build_object(
        _k, jsonb_build_object('from', _old -> _k, 'to', _new -> _k));
    end if;
  end loop;

  _rowid := coalesce(_new ->> 'id', _old ->> 'id');
  _firm := nullif(
    coalesce(
      _new ->> 'firm_id',
      _old ->> 'firm_id',
      case when tg_table_name = 'firms' then coalesce(_new ->> 'id', _old ->> 'id') end
    ), '')::uuid;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (
    auth.uid(),
    _firm,
    'record_' || lower(tg_op),
    tg_table_name,
    _rowid,
    jsonb_build_object('table', tg_table_name, 'op', tg_op, 'changed', _changed)
  );
  return null;
end;
$$;
revoke execute on function public.audit_table_change() from public, anon, authenticated;

drop trigger if exists audit_user_roles_change on public.user_roles;
drop trigger if exists trg_audit_user_roles_change on public.user_roles;
drop trigger if exists user_roles_audit on public.user_roles;

create trigger audit_change after insert or update or delete on public.user_roles
  for each row execute function public.audit_table_change();
create trigger audit_change after insert or update or delete on public.plan_levels
  for each row execute function public.audit_table_change();
create trigger audit_change after insert or update or delete on public.signup_requests
  for each row execute function public.audit_table_change();
create trigger audit_change after insert or update or delete on public.xero_assessment_contact
  for each row execute function public.audit_table_change();
create trigger audit_change after insert or update or delete on public.client_subscriptions
  for each row execute function public.audit_table_change();
create trigger audit_change after insert or update or delete on public.subscriptions
  for each row execute function public.audit_table_change();
create trigger audit_change after insert or update or delete on public.firms
  for each row execute function public.audit_table_change();

-- 2. Bounded, audited super-admin self-join (backlog 30).
create or replace function public.admin_set_self_firm_membership(_firm_id uuid, _join boolean)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  _uid uuid := auth.uid();
  _owner uuid;
  _owner_is_super boolean;
  _prev_status text;
  _prev_role text;
begin
  perform app_private.assert_aal2();
  if _uid is null or not app_private.me_is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  if _firm_id is null then
    raise exception 'Organisation not found.' using errcode = 'no_data_found';
  end if;

  select f.owner_user_id into _owner from public.firms f where f.id = _firm_id;
  if not found then
    raise exception 'Organisation not found.' using errcode = 'no_data_found';
  end if;

  select role::text, status into _prev_role, _prev_status
    from public.firm_members
   where firm_id = _firm_id and user_id = _uid;

  if _join then
    _owner_is_super := _owner is not null
      and exists (select 1 from public.user_roles ur
                   where ur.user_id = _owner and ur.role = 'super_admin');
    if not _owner_is_super then
      raise exception 'This organisation has been handed over. Ask the owner for an invite, or request support access.'
        using errcode = 'insufficient_privilege';
    end if;

    if _prev_status is null then
      insert into public.firm_members (firm_id, user_id, role, status)
      values (_firm_id, _uid, 'staff', 'active');
    else
      update public.firm_members
         set status = 'active',
             role = coalesce(_prev_role, 'staff')::public.firm_member_role,
             updated_at = now()
       where firm_id = _firm_id and user_id = _uid;
    end if;
  else
    delete from public.firm_members where firm_id = _firm_id and user_id = _uid;
  end if;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (
    _uid, _firm_id,
    case when _join then 'platform_staff_joined_firm' else 'platform_staff_left_firm' end,
    'firm', _firm_id::text,
    jsonb_build_object(
      'firm_id', _firm_id,
      'previous_status', _prev_status,
      'previous_role', _prev_role,
      'owner_user_id', _owner)
  );
  return _join;
end;
$$;
revoke execute on function public.admin_set_self_firm_membership(uuid, boolean) from public, anon;
grant execute on function public.admin_set_self_firm_membership(uuid, boolean) to authenticated, service_role;

-- 3. Always-free fails closed when the practice organisation is not recorded (backlog 31).
create or replace function public.set_firm_always_free(_firm_id uuid, _value boolean, _reason text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  _prev boolean;
  _practice uuid;
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  if _reason is null or length(btrim(_reason)) < 3 then
    raise exception 'A reason is required.' using errcode = 'check_violation';
  end if;

  if _value then
    _practice := app_private.practice_firm_id();
    if _practice is null then
      raise exception 'The practice organisation has not been recorded, so the always-free flag cannot be set.'
        using errcode = 'check_violation';
    end if;
    if _firm_id is distinct from _practice then
      raise exception 'The always-free flag is for the practice organisation only.'
        using errcode = 'check_violation';
    end if;
  end if;

  select is_always_free into _prev from public.firms where id = _firm_id;
  if _prev is null then
    raise exception 'Organisation not found.' using errcode = 'no_data_found';
  end if;

  update public.firms set is_always_free = _value where id = _firm_id;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm_id, 'firm_always_free_changed', 'firms', _firm_id::text,
          jsonb_build_object('from', _prev, 'to', _value, 'reason', btrim(_reason)));

  return _value;
end;
$$;