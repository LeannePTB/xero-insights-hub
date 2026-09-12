create or replace function public.security_attestations_list()
returns table (
  check_key text,
  confirmed_by uuid,
  confirmed_by_email text,
  confirmed_at timestamptz,
  note text,
  expires_after_days integer
)
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  return query
    select a.check_key, a.confirmed_by, u.email::text, a.confirmed_at, a.note, a.expires_after_days
    from public.security_attestations a
    left join auth.users u on u.id = a.confirmed_by;
end;
$$;

revoke all on function public.security_attestations_list() from public, anon;
grant execute on function public.security_attestations_list() to authenticated;