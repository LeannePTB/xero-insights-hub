-- Path D / people-and-access Batch 5: super-admin management of the practice team.
-- practice_team already exists (Batch 2) with RLS on, a super-admin-only SELECT
-- policy, the restrictive aal2 guard and writes granted to service_role only.
-- These three definer functions are the only user-initiated write path, and each
-- asserts aal2 and super admin FIRST, is caller-scoped (no caller id parameter),
-- and audits.

create or replace function public.admin_practice_team()
returns table(user_id uuid, added_by uuid, created_at timestamptz, email text, display_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  if not app_private.is_super_admin(auth.uid()) then
    raise exception 'Not authorised.';
  end if;
  return query
    select pt.user_id, pt.added_by, pt.created_at,
           u.email::text, p.display_name
    from public.practice_team pt
    left join auth.users u on u.id = pt.user_id
    left join public.profiles p on p.id = pt.user_id
    order by pt.created_at;
end;
$$;

create or replace function public.admin_add_practice_member(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  if not app_private.is_super_admin(auth.uid()) then
    raise exception 'Not authorised.';
  end if;
  if not exists (select 1 from auth.users u where u.id = _user_id) then
    raise exception 'No such person.';
  end if;
  insert into public.practice_team (user_id, added_by)
  values (_user_id, auth.uid())
  on conflict (user_id) do nothing;

  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'practice_team_member_added', 'user', _user_id::text,
          jsonb_build_object('user_id', _user_id));
end;
$$;

create or replace function public.admin_remove_practice_member(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  if not app_private.is_super_admin(auth.uid()) then
    raise exception 'Not authorised.';
  end if;
  delete from public.practice_team where user_id = _user_id;

  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'practice_team_member_removed', 'user', _user_id::text,
          jsonb_build_object('user_id', _user_id));
end;
$$;

revoke execute on function public.admin_practice_team() from public, anon;
revoke execute on function public.admin_add_practice_member(uuid) from public, anon;
revoke execute on function public.admin_remove_practice_member(uuid) from public, anon;
grant execute on function public.admin_practice_team() to authenticated;
grant execute on function public.admin_add_practice_member(uuid) to authenticated;
grant execute on function public.admin_remove_practice_member(uuid) to authenticated;