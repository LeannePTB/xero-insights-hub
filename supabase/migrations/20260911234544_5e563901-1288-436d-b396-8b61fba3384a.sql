create or replace function public.client_xero_files_used(_client_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  if _client_id is null then
    return 0;
  end if;
  if auth.uid() is not null and not public.user_can_read_client(auth.uid(), _client_id) then
    raise exception 'Not authorised for this client.';
  end if;
  return app_private.client_xero_files_used(_client_id);
end;
$$;

revoke all on function public.client_xero_files_used(uuid) from public, anon;
grant execute on function public.client_xero_files_used(uuid) to authenticated;