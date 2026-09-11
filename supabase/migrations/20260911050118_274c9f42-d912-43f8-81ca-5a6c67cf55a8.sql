-- 1. Write helper: membership or client ownership only. Never a support grant.
create or replace function app_private.user_can_write_client(_user_id uuid, _client_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
    select exists (
      select 1 from public.clients c
      where c.id = _client_id
        and (c.owner_user_id = _user_id
             or (c.firm_id is not null and app_private.has_firm_access(_user_id, c.firm_id)))
    )
  ) end
$$;
revoke execute on function app_private.user_can_write_client(uuid, uuid) from public, anon;

comment on function app_private.user_can_manage_client(uuid, uuid) is
  'READ helper: client owner, active member, or an approved read-only support grant. Never use for writes — use app_private.user_can_write_client.';

-- 2. Server-callable write checks (aal2 guarded).
create or replace function public.user_can_write_firm(_user_id uuid, _firm_id uuid)
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform app_private.assert_aal2();
  if auth.uid() is not null and _user_id is distinct from auth.uid() then return false; end if;
  return _user_id is not null and _firm_id is not null
     and app_private.has_firm_access(_user_id, _firm_id);
end;
$$;
revoke execute on function public.user_can_write_firm(uuid, uuid) from public, anon;
grant execute on function public.user_can_write_firm(uuid, uuid) to authenticated, service_role;

create or replace function public.user_can_write_client(_user_id uuid, _client_id uuid)
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform app_private.assert_aal2();
  if auth.uid() is not null and _user_id is distinct from auth.uid() then return false; end if;
  return _user_id is not null and _client_id is not null
     and app_private.user_can_write_client(_user_id, _client_id);
end;
$$;
revoke execute on function public.user_can_write_client(uuid, uuid) from public, anon;
grant execute on function public.user_can_write_client(uuid, uuid) to authenticated, service_role;

-- 3. Moving a Xero file is a write: membership only.
create or replace function app_private.move_xero_file_to_client(_connection_id uuid, _target_client_id uuid, _actor_user_id uuid)
returns void language plpgsql set search_path to 'public', 'app_private' as $$
DECLARE
  v_source_client_id uuid;
  v_source_firm_id uuid;
  v_target_firm_id uuid;
BEGIN
  IF NOT app_private.user_can_write_client(_actor_user_id, _target_client_id) THEN RAISE EXCEPTION 'You cannot manage the target client subscription'; END IF;
  SELECT cxo.client_id, c.firm_id INTO v_source_client_id, v_source_firm_id
  FROM public.client_xero_orgs cxo JOIN public.clients c ON c.id = cxo.client_id
  WHERE cxo.xero_connection_id = _connection_id FOR UPDATE OF cxo;
  SELECT firm_id INTO v_target_firm_id FROM public.clients WHERE id = _target_client_id;
  IF v_source_client_id IS NULL THEN RAISE EXCEPTION 'That Xero file is no longer linked to another subscription'; END IF;
  IF v_source_client_id = _target_client_id THEN RAISE EXCEPTION 'That Xero file is already linked to this subscription'; END IF;
  IF v_source_firm_id IS DISTINCT FROM v_target_firm_id AND NOT app_private.is_super_admin(_actor_user_id) THEN RAISE EXCEPTION 'Only a platform admin can move a Xero file between organisations'; END IF;
  IF NOT app_private.is_super_admin(_actor_user_id) AND NOT app_private.user_can_write_client(_actor_user_id, v_source_client_id) THEN RAISE EXCEPTION 'You cannot manage the subscription that currently holds this Xero file'; END IF;
  DELETE FROM public.client_xero_orgs WHERE xero_connection_id = _connection_id;
  INSERT INTO public.client_xero_orgs (client_id, xero_connection_id) VALUES (_target_client_id, _connection_id);
  UPDATE public.xero_connections SET firm_id = v_target_firm_id WHERE id = _connection_id;
END;
$$;

-- 4. The only write policy that admitted a support grant. It required
--    super admin + grant, so no member loses a write.
drop policy if exists "staff manage client subscriptions" on public.client_subscriptions;

-- 5. Backlog 25 (owner approved): support grants may READ these two tables.
create policy "support grant reads firm clients"
  on public.clients as permissive for select to authenticated
  using (firm_id is not null and app_private.platform_staff_can_access_firm(auth.uid(), firm_id));

create policy "support grant reads statutory accounts"
  on public.client_statutory_accounts as permissive for select to authenticated
  using (exists (
    select 1 from public.clients c
    where c.id = client_statutory_accounts.client_id
      and c.firm_id is not null
      and app_private.platform_staff_can_access_firm(auth.uid(), c.firm_id)
  ));