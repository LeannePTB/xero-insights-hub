-- One counter for "how many Xero files is this client actually using".
-- Disconnected files do not count: the client-to-file link is deliberately
-- kept when a file is disconnected, so counting links alone would cap a
-- client on files they no longer use.
create or replace function app_private.client_xero_files_used(
  _client_id uuid,
  _exclude_link_id uuid default null
) returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.client_xero_orgs cxo
  join public.xero_connections xc on xc.id = cxo.xero_connection_id
  where cxo.client_id = _client_id
    and (_exclude_link_id is null or cxo.id <> _exclude_link_id)
    and coalesce(xc.status, 'connected') <> 'disconnected'
$$;

revoke all on function app_private.client_xero_files_used(uuid, uuid) from public, anon, authenticated;

-- Client-level Xero file allowance: same rule, one implementation.
create or replace function public.enforce_client_xero_org_allowance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
begin
  select c.max_xero_orgs into v_limit from public.clients c where c.id = NEW.client_id;
  if v_limit is null then
    raise exception 'Client subscription not found';
  end if;

  v_used := app_private.client_xero_files_used(
    NEW.client_id,
    case when TG_OP = 'UPDATE' then NEW.id else null end
  );

  if v_used >= v_limit then
    raise exception 'This client subscription has reached its Xero file allowance of %', v_limit;
  end if;

  return NEW;
end;
$$;

create or replace function public.enforce_client_max_xero_orgs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  if NEW.max_xero_orgs < 1 then
    raise exception 'Xero file allowance must be at least 1';
  end if;

  v_used := app_private.client_xero_files_used(NEW.id);

  if NEW.max_xero_orgs < v_used then
    raise exception 'Unlink Xero files before reducing the allowance below %', v_used;
  end if;

  return NEW;
end;
$$;

-- Who may disconnect a Xero file. Write path, so membership or client-write
-- only: a support grant is read-only (rule 5) and a bare super admin gets
-- nothing (rule 3). The connection id is a FILTER: the organisation and the
-- linked client are resolved here from our own rows (rule 4).
create or replace function public.user_can_disconnect_xero_connection(
  _user_id uuid,
  _connection_id uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_firm_id uuid;
  v_client_id uuid;
begin
  perform app_private.assert_aal2();
  if auth.uid() is not null and _user_id is distinct from auth.uid() then
    return false;
  end if;
  if _user_id is null or _connection_id is null then
    return false;
  end if;

  select xc.firm_id into v_firm_id
  from public.xero_connections xc
  where xc.id = _connection_id;
  if v_firm_id is null and not exists (
    select 1 from public.xero_connections where id = _connection_id
  ) then
    return false;
  end if;

  select cxo.client_id into v_client_id
  from public.client_xero_orgs cxo
  where cxo.xero_connection_id = _connection_id
  limit 1;

  if v_client_id is not null then
    return app_private.user_can_write_client(_user_id, v_client_id);
  end if;

  if v_firm_id is not null then
    return app_private.has_firm_access(_user_id, v_firm_id);
  end if;

  return false;
end;
$$;

revoke all on function public.user_can_disconnect_xero_connection(uuid, uuid) from public, anon;
grant execute on function public.user_can_disconnect_xero_connection(uuid, uuid) to authenticated;