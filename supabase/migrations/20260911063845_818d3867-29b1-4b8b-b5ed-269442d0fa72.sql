create or replace function public.assert_advisor()
returns void
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  if not exists (
    select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'advisor'
  ) then
    raise exception 'Only advisors can manage advisors.';
  end if;
end;
$$;

revoke execute on function public.assert_advisor() from public, anon;
grant execute on function public.assert_advisor() to authenticated, service_role;
