-- Phase 4 batch 2: caller-scoped authorisation helpers.
-- Every function is caller-scoped (auth.uid(), no user-id parameter),
-- aal2-guarded, SET search_path, and EXECUTE revoked from PUBLIC/anon.

create or replace function public.me_is_super_admin()
returns boolean language plpgsql stable security definer set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  return app_private.me_is_super_admin();
end;
$$;

create or replace function public.me_has_role(_role app_role)
returns boolean language plpgsql stable security definer set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then return false; end if;
  return exists (select 1 from public.user_roles where user_id = auth.uid() and role = _role);
end;
$$;

-- Active organisation memberships of the caller, oldest first.
create or replace function public.my_firm_ids()
returns table(firm_id uuid) language plpgsql stable security definer set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  return query
    select fm.firm_id from public.firm_members fm
    where fm.user_id = auth.uid() and fm.status = 'active'
    order by fm.created_at;
end;
$$;

create or replace function public.user_can_read_client(_client_id uuid)
returns boolean language plpgsql stable security definer set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null or _client_id is null then return false; end if;
  return app_private.user_can_read_client(auth.uid(), _client_id);
end;
$$;

-- Viewers of a client, with the VERIFIED auth email (never profiles.email).
-- Same audience as the "manage client access by firm (read)" policy.
create or replace function public.client_viewers(_client_id uuid)
returns table(id uuid, user_id uuid, tier text, created_at timestamptz,
              email text, display_name text)
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  if not app_private.user_can_manage_client(auth.uid(), _client_id) then
    raise exception 'You cannot view this client''s access list.';
  end if;
  return query
    select ca.id, ca.user_id, ca.tier::text, ca.created_at,
           u.email::text, p.display_name
    from public.client_access ca
    left join auth.users u on u.id = ca.user_id
    left join public.profiles p on p.id = ca.user_id
    where ca.client_id = _client_id;
end;
$$;

-- Writes. Same rule as the client_access write policies: client owner or an
-- active member of the client's organisation. A support grant never qualifies.
create or replace function public.grant_client_access(_client_id uuid, _user_id uuid, _tier dashboard_tier)
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

create or replace function public.set_client_access_tier(_id uuid, _tier dashboard_tier)
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

create or replace function public.revoke_client_access(_id uuid)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare _client uuid;
begin
  perform app_private.assert_aal2();
  select client_id into _client from public.client_access where id = _id;
  if _client is null then return; end if;
  if not app_private.user_can_write_client(auth.uid(), _client) then
    raise exception 'You cannot manage access for this client.';
  end if;
  delete from public.client_access where id = _id;
end;
$$;

revoke all on function public.me_is_super_admin() from public, anon;
revoke all on function public.me_has_role(app_role) from public, anon;
revoke all on function public.my_firm_ids() from public, anon;
revoke all on function public.user_can_read_client(uuid) from public, anon;
revoke all on function public.client_viewers(uuid) from public, anon;
revoke all on function public.grant_client_access(uuid, uuid, dashboard_tier) from public, anon;
revoke all on function public.set_client_access_tier(uuid, dashboard_tier) from public, anon;
revoke all on function public.revoke_client_access(uuid) from public, anon;

grant execute on function public.me_is_super_admin() to authenticated, service_role;
grant execute on function public.me_has_role(app_role) to authenticated, service_role;
grant execute on function public.my_firm_ids() to authenticated, service_role;
grant execute on function public.user_can_read_client(uuid) to authenticated, service_role;
grant execute on function public.client_viewers(uuid) to authenticated, service_role;
grant execute on function public.grant_client_access(uuid, uuid, dashboard_tier) to authenticated, service_role;
grant execute on function public.set_client_access_tier(uuid, dashboard_tier) to authenticated, service_role;
grant execute on function public.revoke_client_access(uuid) to authenticated, service_role;