-- ============================================================
-- Batch 3: viewer grants + viewer invites
-- ============================================================

-- 1. Authorisation helper: who may manage client viewers for a client.
--    Organisation owner, or an active Positive Traction member of THAT
--    organisation (app_private.can_manage_client_viewers), or the client's own
--    owner when the client sits outside any organisation.
create or replace function app_private.can_manage_viewers_for_client(_user_id uuid, _client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
    exists (
      select 1
      from public.clients c
      where c.id = _client_id
        and (
          (c.firm_id is not null and app_private.can_manage_client_viewers(_user_id, c.firm_id))
          or (c.firm_id is null and c.owner_user_id = _user_id)
        )
    )
  ) end
$$;

revoke all on function app_private.can_manage_viewers_for_client(uuid, uuid) from public;
revoke all on function app_private.can_manage_viewers_for_client(uuid, uuid) from anon;
grant execute on function app_private.can_manage_viewers_for_client(uuid, uuid) to authenticated, service_role;

-- 2. Existing specific-grant functions: re-point authorisation + audit.
create or replace function public.grant_client_access(_client_id uuid, _user_id uuid, _tier text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare _firm uuid;
begin
  perform app_private.assert_aal2();
  if not app_private.can_manage_viewers_for_client(auth.uid(), _client_id) then
    raise exception 'You cannot manage access for this client.';
  end if;
  select firm_id into _firm from public.clients where id = _client_id;

  insert into public.user_roles (user_id, role) values (_user_id, 'client_viewer')
  on conflict (user_id, role) do nothing;
  insert into public.client_access (client_id, user_id, tier)
  values (_client_id, _user_id, _tier)
  on conflict (client_id, user_id) do update set tier = excluded.tier;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm, 'client_viewer_granted', 'client', _client_id::text,
          jsonb_build_object('user_id', _user_id, 'tier', _tier, 'scope', 'client'));
end;
$$;

create or replace function public.set_client_access_tier(_id uuid, _tier text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare _client uuid; _firm uuid; _user uuid;
begin
  perform app_private.assert_aal2();
  select client_id, user_id into _client, _user from public.client_access where id = _id;
  if _client is null then raise exception 'Access row not found.'; end if;
  if not app_private.can_manage_viewers_for_client(auth.uid(), _client) then
    raise exception 'You cannot manage access for this client.';
  end if;
  update public.client_access set tier = _tier where id = _id;
  select firm_id into _firm from public.clients where id = _client;
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm, 'client_viewer_tier_changed', 'client', _client::text,
          jsonb_build_object('user_id', _user, 'tier', _tier, 'scope', 'client'));
end;
$$;

create or replace function public.revoke_client_access(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare _client uuid; _firm uuid; _user uuid;
begin
  perform app_private.assert_aal2();
  select client_id, user_id into _client, _user from public.client_access where id = _id;
  if _client is null then return; end if;
  if not app_private.can_manage_viewers_for_client(auth.uid(), _client) then
    raise exception 'You cannot manage access for this client.';
  end if;
  delete from public.client_access where id = _id;
  select firm_id into _firm from public.clients where id = _client;
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm, 'client_viewer_revoked', 'client', _client::text,
          jsonb_build_object('user_id', _user, 'scope', 'client'));
end;
$$;

-- Read of the list stays available to organisation members (staff included --
-- no behaviour change) and additionally to whoever may manage viewers.
create or replace function public.client_viewers(_client_id uuid)
returns table(id uuid, user_id uuid, tier text, created_at timestamptz, email text, display_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  if not (
    app_private.user_can_manage_client(auth.uid(), _client_id)
    or app_private.can_manage_viewers_for_client(auth.uid(), _client_id)
  ) then
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

-- 3. client_access write policies re-pointed to the same helper so staff
--    cannot write viewer rows directly.
drop policy if exists "manage client access by firm (insert)" on public.client_access;
drop policy if exists "manage client access by firm (update)" on public.client_access;
drop policy if exists "manage client access by firm (delete)" on public.client_access;

create policy "viewer managers write client access (insert)"
  on public.client_access as permissive for insert to authenticated
  with check (app_private.can_manage_viewers_for_client(auth.uid(), client_id));

create policy "viewer managers write client access (update)"
  on public.client_access as permissive for update to authenticated
  using (app_private.can_manage_viewers_for_client(auth.uid(), client_id))
  with check (app_private.can_manage_viewers_for_client(auth.uid(), client_id));

create policy "viewer managers write client access (delete)"
  on public.client_access as permissive for delete to authenticated
  using (app_private.can_manage_viewers_for_client(auth.uid(), client_id));

-- 4. Standing grant management functions.
create or replace function public.grant_firm_viewer_access(_firm_id uuid, _user_id uuid, _tier public.dashboard_tier)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare _id uuid;
begin
  perform app_private.assert_aal2();
  if not app_private.can_manage_client_viewers(auth.uid(), _firm_id) then
    raise exception 'You cannot manage viewers for this organisation.';
  end if;
  insert into public.user_roles (user_id, role) values (_user_id, 'client_viewer')
  on conflict (user_id, role) do nothing;
  insert into public.firm_viewer_access (firm_id, user_id, tier, granted_by)
  values (_firm_id, _user_id, _tier, auth.uid())
  on conflict (firm_id, user_id) do update set tier = excluded.tier, updated_at = now()
  returning id into _id;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm_id, 'standing_viewer_granted', 'firm', _firm_id::text,
          jsonb_build_object('user_id', _user_id, 'tier', _tier, 'scope', 'all_clients'));
  return _id;
end;
$$;

create or replace function public.set_firm_viewer_tier(_id uuid, _tier public.dashboard_tier)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare _firm uuid; _user uuid;
begin
  perform app_private.assert_aal2();
  select firm_id, user_id into _firm, _user from public.firm_viewer_access where id = _id;
  if _firm is null then raise exception 'Access row not found.'; end if;
  if not app_private.can_manage_client_viewers(auth.uid(), _firm) then
    raise exception 'You cannot manage viewers for this organisation.';
  end if;
  update public.firm_viewer_access set tier = _tier, updated_at = now() where id = _id;
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm, 'standing_viewer_tier_changed', 'firm', _firm::text,
          jsonb_build_object('user_id', _user, 'tier', _tier, 'scope', 'all_clients'));
end;
$$;

create or replace function public.revoke_firm_viewer_access(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare _firm uuid; _user uuid;
begin
  perform app_private.assert_aal2();
  select firm_id, user_id into _firm, _user from public.firm_viewer_access where id = _id;
  if _firm is null then return; end if;
  if not app_private.can_manage_client_viewers(auth.uid(), _firm) then
    raise exception 'You cannot manage viewers for this organisation.';
  end if;
  delete from public.firm_viewer_access where id = _id;
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm, 'standing_viewer_revoked', 'firm', _firm::text,
          jsonb_build_object('user_id', _user, 'scope', 'all_clients'));
end;
$$;

create or replace function public.firm_viewers(_firm_id uuid)
returns table(id uuid, user_id uuid, tier public.dashboard_tier, created_at timestamptz,
              email text, display_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  if not (
    app_private.can_manage_client_viewers(auth.uid(), _firm_id)
    or app_private.has_firm_access(auth.uid(), _firm_id)
  ) then
    raise exception 'You cannot view this organisation''s viewers.';
  end if;
  return query
    select fva.id, fva.user_id, fva.tier, fva.created_at,
           u.email::text, p.display_name
    from public.firm_viewer_access fva
    left join auth.users u on u.id = fva.user_id
    left join public.profiles p on p.id = fva.user_id
    where fva.firm_id = _firm_id;
end;
$$;

revoke all on function public.grant_firm_viewer_access(uuid, uuid, public.dashboard_tier) from public;
revoke all on function public.grant_firm_viewer_access(uuid, uuid, public.dashboard_tier) from anon;
grant execute on function public.grant_firm_viewer_access(uuid, uuid, public.dashboard_tier) to authenticated, service_role;
revoke all on function public.set_firm_viewer_tier(uuid, public.dashboard_tier) from public;
revoke all on function public.set_firm_viewer_tier(uuid, public.dashboard_tier) from anon;
grant execute on function public.set_firm_viewer_tier(uuid, public.dashboard_tier) to authenticated, service_role;
revoke all on function public.revoke_firm_viewer_access(uuid) from public;
revoke all on function public.revoke_firm_viewer_access(uuid) from anon;
grant execute on function public.revoke_firm_viewer_access(uuid) to authenticated, service_role;
revoke all on function public.firm_viewers(uuid) from public;
revoke all on function public.firm_viewers(uuid) from anon;
grant execute on function public.firm_viewers(uuid) to authenticated, service_role;

-- 5. Viewer invites on the existing invite machinery.
alter table public.access_invites
  add column if not exists kind text not null default 'member',
  add column if not exists scope text,
  add column if not exists tier public.dashboard_tier,
  add column if not exists client_ids uuid[] not null default '{}'::uuid[];

alter table public.access_invites
  drop constraint if exists access_invites_kind_check;
alter table public.access_invites
  add constraint access_invites_kind_check check (kind in ('member', 'viewer'));

alter table public.access_invites
  drop constraint if exists access_invites_viewer_shape_check;
alter table public.access_invites
  add constraint access_invites_viewer_shape_check check (
    kind = 'member'
    or (scope in ('selected', 'all_clients') and tier is not null
        and (scope = 'all_clients' or array_length(client_ids, 1) >= 1))
  );

-- `role` stays NOT NULL (never dropped); on a viewer invite it is inert. Every
-- member path filters on kind = 'member' so a viewer invite can never be
-- accepted, listed or revoked as a team-member invitation.
create or replace function public.firm_member_invites(_firm_id uuid)
returns table(id uuid, email text, role public.firm_member_role, expires_at timestamptz,
              created_at timestamptz, invited_by uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'NOT_PERMITTED' using errcode = '42501';
  end if;

  return query
  select i.id, i.email, i.role, i.expires_at, i.created_at, i.invited_by
  from public.access_invites i
  where i.firm_id = _firm_id
    and i.accepted_at is null
    and i.kind = 'member'
  order by i.created_at desc;
end;
$$;

create or replace function public.revoke_firm_member_invite(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.access_invites;
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'NOT_PERMITTED' using errcode = '42501';
  end if;

  select * into v_invite from public.access_invites where id = _id and kind = 'member';
  if v_invite.id is null then
    raise exception 'INVITE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'INVITE_ALREADY_ACCEPTED' using errcode = '22023';
  end if;

  delete from public.access_invites where id = _id;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), v_invite.firm_id, 'firm_invite_revoked', 'firm', v_invite.firm_id::text,
          jsonb_build_object('email', v_invite.email, 'role', v_invite.role));
end;
$$;

-- Pending viewer invitations for one organisation (whoever may manage viewers,
-- or an organisation member for read).
create or replace function public.firm_viewer_invites(_firm_id uuid)
returns table(id uuid, email text, scope text, tier public.dashboard_tier,
              client_ids uuid[], expires_at timestamptz, created_at timestamptz, invited_by uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  if not (
    app_private.can_manage_client_viewers(auth.uid(), _firm_id)
    or app_private.has_firm_access(auth.uid(), _firm_id)
  ) then
    raise exception 'NOT_PERMITTED' using errcode = '42501';
  end if;
  return query
  select i.id, i.email, i.scope, i.tier, i.client_ids, i.expires_at, i.created_at, i.invited_by
  from public.access_invites i
  where i.firm_id = _firm_id and i.kind = 'viewer' and i.accepted_at is null
  order by i.created_at desc;
end;
$$;

create or replace function public.revoke_viewer_invite(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_invite public.access_invites;
begin
  perform app_private.assert_aal2();
  select * into v_invite from public.access_invites where id = _id and kind = 'viewer';
  if v_invite.id is null then raise exception 'INVITE_NOT_FOUND' using errcode = 'P0002'; end if;
  if not app_private.can_manage_client_viewers(auth.uid(), v_invite.firm_id) then
    raise exception 'NOT_PERMITTED' using errcode = '42501';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'INVITE_ALREADY_ACCEPTED' using errcode = '22023';
  end if;
  delete from public.access_invites where id = _id;
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), v_invite.firm_id, 'viewer_invite_revoked', 'firm', v_invite.firm_id::text,
          jsonb_build_object('email', v_invite.email, 'scope', v_invite.scope));
end;
$$;

revoke all on function public.firm_viewer_invites(uuid) from public;
revoke all on function public.firm_viewer_invites(uuid) from anon;
grant execute on function public.firm_viewer_invites(uuid) to authenticated, service_role;
revoke all on function public.revoke_viewer_invite(uuid) from public;
revoke all on function public.revoke_viewer_invite(uuid) from anon;
grant execute on function public.revoke_viewer_invite(uuid) to authenticated, service_role;

-- 6. Acceptance: one transaction, ids re-validated against the organisation.
--    System context only (invite acceptance has no session): service_role only.
create or replace function public.apply_viewer_invite(_invite_id uuid, _user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.access_invites;
  v_ids uuid[];
  v_count int := 0;
begin
  select * into v from public.access_invites where id = _invite_id and kind = 'viewer' for update;
  if v.id is null then raise exception 'INVITE_NOT_FOUND' using errcode = 'P0002'; end if;
  if v.accepted_at is not null then raise exception 'INVITE_ALREADY_ACCEPTED' using errcode = '22023'; end if;
  if v.expires_at < now() then raise exception 'INVITE_EXPIRED' using errcode = '22023'; end if;

  insert into public.user_roles (user_id, role) values (_user_id, 'client_viewer')
  on conflict (user_id, role) do nothing;

  if v.scope = 'all_clients' then
    insert into public.firm_viewer_access (firm_id, user_id, tier, granted_by)
    values (v.firm_id, _user_id, v.tier, v.invited_by)
    on conflict (firm_id, user_id) do update set tier = excluded.tier, updated_at = now();
  else
    -- Never trust the ids on the invite: only clients that still belong to this
    -- organisation survive. Deleted or moved clients are skipped silently.
    select coalesce(array_agg(c.id), '{}'::uuid[]) into v_ids
    from public.clients c
    where c.id = any(v.client_ids) and c.firm_id = v.firm_id;

    v_count := coalesce(array_length(v_ids, 1), 0);
    if v_count = 0 then
      raise exception 'VIEWER_INVITE_NO_CLIENTS' using errcode = '22023';
    end if;

    insert into public.client_access (client_id, user_id, tier)
    select cid, _user_id, v.tier::text from unnest(v_ids) as cid
    on conflict (client_id, user_id) do update set tier = excluded.tier;
  end if;

  update public.access_invites set accepted_at = now() where id = v.id;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (_user_id, v.firm_id, 'viewer_invite_accepted', 'firm', v.firm_id::text,
          jsonb_build_object('email', v.email, 'scope', v.scope, 'tier', v.tier,
                             'client_count', case when v.scope = 'all_clients' then null else v_count end));

  return jsonb_build_object('scope', v.scope, 'tier', v.tier, 'client_count', v_count);
end;
$$;

revoke all on function public.apply_viewer_invite(uuid, uuid) from public;
revoke all on function public.apply_viewer_invite(uuid, uuid) from anon;
revoke all on function public.apply_viewer_invite(uuid, uuid) from authenticated;
grant execute on function public.apply_viewer_invite(uuid, uuid) to service_role;