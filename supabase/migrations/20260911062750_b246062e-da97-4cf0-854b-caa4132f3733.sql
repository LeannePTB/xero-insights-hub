create or replace function public.client_access_tiers(_client_id uuid)
returns setof text language plpgsql stable security definer set search_path to 'public'
as $$
begin
  -- System contexts (service role, no auth.uid) read this during the Xero
  -- callback. A signed-in caller must be able to read the client.
  if auth.uid() is not null then
    perform app_private.assert_aal2();
    if not app_private.user_can_read_client(auth.uid(), _client_id) then
      raise exception 'You cannot view this client.';
    end if;
  end if;
  return query select ca.tier::text from public.client_access ca where ca.client_id = _client_id;
end;
$$;

revoke all on function public.client_access_tiers(uuid) from public, anon;
grant execute on function public.client_access_tiers(uuid) to authenticated, service_role;