drop function if exists public.organisation_members(uuid);

create or replace function public.organisation_members(_firm_id uuid)
returns table(user_id uuid, role text, status text, email text, display_name text, is_practice boolean)
language plpgsql
stable
security definer
set search_path = public
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
           u.email::text, p.display_name,
           exists (select 1 from public.practice_team pt where pt.user_id = fm.user_id) as is_practice
    from public.firm_members fm
    left join auth.users u on u.id = fm.user_id
    left join public.profiles p on p.id = fm.user_id
    where fm.firm_id = _firm_id and fm.status = 'active';
end;
$$;

revoke all on function public.organisation_members(uuid) from public;
revoke all on function public.organisation_members(uuid) from anon;
grant execute on function public.organisation_members(uuid) to authenticated, service_role;