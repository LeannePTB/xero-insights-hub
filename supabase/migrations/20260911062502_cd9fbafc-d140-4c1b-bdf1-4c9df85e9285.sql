drop function if exists public.grant_client_access(uuid, uuid, dashboard_tier);
drop function if exists public.set_client_access_tier(uuid, dashboard_tier);

create or replace function public.grant_client_access(_client_id uuid, _user_id uuid, _tier text)
returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  if not app_private.user_can_write_client(auth.uid(), _client_id) then
    raise exception 'You cannot manage access for this client.';
  end if;
  insert into public.user_roles (user_id, role) values (_user_id, 'client_viewer')
  on conflict (user_id, role) do nothing;
  insert into public.client_access (client_id, user_id, tier)
  values (_client_id, _user_id, _tier)
  on conflict (client_id, user_id) do update set tier = excluded.tier;
end;
$$;

create or replace function public.set_client_access_tier(_id uuid, _tier text)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare _client uuid;
begin
  perform app_private.assert_aal2();
  select client_id into _client from public.client_access where id = _id;
  if _client is null then raise exception 'Access row not found.'; end if;
  if not app_private.user_can_write_client(auth.uid(), _client) then
    raise exception 'You cannot manage access for this client.';
  end if;
  update public.client_access set tier = _tier where id = _id;
end;
$$;

-- Which client an access row belongs to. Only for callers who may manage it,
-- so the app can run the plan-tier check without reading client_access.
create or replace function public.client_for_access(_id uuid)
returns uuid language plpgsql stable security definer set search_path to 'public'
as $$
declare _client uuid;
begin
  perform app_private.assert_aal2();
  select client_id into _client from public.client_access where id = _id;
  if _client is null then return null; end if;
  if not app_private.user_can_write_client(auth.uid(), _client) then
    raise exception 'You cannot manage access for this client.';
  end if;
  return _client;
end;
$$;

revoke all on function public.grant_client_access(uuid, uuid, text) from public, anon;
revoke all on function public.set_client_access_tier(uuid, text) from public, anon;
revoke all on function public.client_for_access(uuid) from public, anon;
grant execute on function public.grant_client_access(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.set_client_access_tier(uuid, text) to authenticated, service_role;
grant execute on function public.client_for_access(uuid) to authenticated, service_role;