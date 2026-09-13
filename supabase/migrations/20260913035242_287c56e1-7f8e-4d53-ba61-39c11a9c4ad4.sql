create type public.client_access_relationship as enum ('business_owner', 'external_adviser');

alter table public.client_access
  add column relationship public.client_access_relationship,
  add column inviter_label text;
alter table public.client_access
  add constraint client_access_inviter_label_check check (
    inviter_label is null or (
      inviter_label = btrim(inviter_label)
      and char_length(inviter_label) between 1 and 80
      and inviter_label !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  );

alter table public.firm_viewer_access
  add column inviter_label text;
alter table public.firm_viewer_access
  add constraint firm_viewer_access_inviter_label_check check (
    inviter_label is null or (
      inviter_label = btrim(inviter_label)
      and char_length(inviter_label) between 1 and 80
      and inviter_label !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  );

alter table public.access_invites
  add column relationship public.client_access_relationship,
  add column inviter_label text;
alter table public.access_invites
  add constraint access_invites_inviter_label_check check (
    inviter_label is null or (
      inviter_label = btrim(inviter_label)
      and char_length(inviter_label) between 1 and 80
      and inviter_label !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  );

alter table public.access_invites drop constraint if exists access_invites_viewer_shape_check;
alter table public.access_invites add constraint access_invites_viewer_shape_check check (
  kind = 'member'
  or (
    scope in ('selected', 'all_clients')
    and tier is not null
    and (scope = 'all_clients' or array_length(client_ids, 1) >= 1)
    and (relationship is null or relationship = 'external_adviser' or scope = 'selected')
  )
);

-- Every browser-session write now goes through the audited functions below.
drop policy if exists "viewer managers write client access (insert)" on public.client_access;
drop policy if exists "viewer managers write client access (update)" on public.client_access;
drop policy if exists "viewer managers write client access (delete)" on public.client_access;
revoke insert, update, delete on public.client_access from authenticated;

-- Replace the grant function with optional relationship/label inputs. Defaults
-- keep legacy callers safe while every new People invitation supplies both.
drop function public.grant_client_access(uuid, uuid, text);
create function public.grant_client_access(
  _client_id uuid,
  _user_id uuid,
  _tier text,
  _relationship public.client_access_relationship default null,
  _inviter_label text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare _firm uuid; _label text;
begin
  perform app_private.assert_aal2();
  if not app_private.can_manage_viewers_for_client(auth.uid(), _client_id) then
    raise exception 'You cannot manage access for this client.';
  end if;
  _label := nullif(btrim(_inviter_label), '');
  if _label is not null and (char_length(_label) > 80 or _label ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'INVALID_INVITER_LABEL' using errcode = '22023';
  end if;
  select firm_id into _firm from public.clients where id = _client_id;

  insert into public.user_roles (user_id, role) values (_user_id, 'client_viewer')
  on conflict (user_id, role) do nothing;
  insert into public.client_access (client_id, user_id, tier, relationship, inviter_label)
  values (_client_id, _user_id, _tier, _relationship, _label)
  on conflict (client_id, user_id) do update
    set tier = excluded.tier,
        relationship = excluded.relationship,
        inviter_label = coalesce(excluded.inviter_label, public.client_access.inviter_label);

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm, 'client_viewer_granted', 'client', _client_id::text,
          jsonb_build_object('user_id', _user_id, 'tier', _tier, 'scope', 'client',
                             'relationship', _relationship, 'inviter_label', _label));
end;
$$;
revoke all on function public.grant_client_access(uuid, uuid, text, public.client_access_relationship, text) from public, anon;
grant execute on function public.grant_client_access(uuid, uuid, text, public.client_access_relationship, text) to authenticated, service_role;

create function public.set_client_access_relationship(
  _id uuid,
  _relationship public.client_access_relationship
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare _client uuid; _firm uuid; _user uuid; _previous public.client_access_relationship;
begin
  perform app_private.assert_aal2();
  select client_id, user_id, relationship into _client, _user, _previous
  from public.client_access where id = _id for update;
  if _client is null then raise exception 'Access row not found.'; end if;
  if not app_private.can_manage_viewers_for_client(auth.uid(), _client) then
    raise exception 'You cannot manage access for this client.';
  end if;
  update public.client_access set relationship = _relationship where id = _id;
  select firm_id into _firm from public.clients where id = _client;
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm, 'client_viewer_relationship_changed', 'client', _client::text,
          jsonb_build_object('user_id', _user, 'previous_relationship', _previous,
                             'relationship', _relationship));
end;
$$;
revoke all on function public.set_client_access_relationship(uuid, public.client_access_relationship) from public, anon;
grant execute on function public.set_client_access_relationship(uuid, public.client_access_relationship) to authenticated, service_role;

-- Return relationship, label, and verified sign-in email to authorised lists.
drop function public.client_viewers(uuid);
create function public.client_viewers(_client_id uuid)
returns table(
  id uuid, user_id uuid, tier text, relationship public.client_access_relationship,
  inviter_label text, created_at timestamptz, email text, display_name text
)
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
    select ca.id, ca.user_id, ca.tier::text, ca.relationship, ca.inviter_label,
           ca.created_at, u.email::text, p.display_name
    from public.client_access ca
    left join auth.users u on u.id = ca.user_id
    left join public.profiles p on p.id = ca.user_id
    where ca.client_id = _client_id;
end;
$$;
revoke all on function public.client_viewers(uuid) from public, anon;
grant execute on function public.client_viewers(uuid) to authenticated, service_role;

drop function public.my_client_access();
create function public.my_client_access()
returns table(
  id uuid, client_id uuid, client_name text, tier text,
  relationship public.client_access_relationship, inviter_label text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  return query
    select ca.id, ca.client_id, c.name, ca.tier::text, ca.relationship, ca.inviter_label
    from public.client_access ca
    join public.clients c on c.id = ca.client_id
    where ca.user_id = auth.uid()
    order by c.name;
end;
$$;
revoke all on function public.my_client_access() from public, anon;
grant execute on function public.my_client_access() to authenticated;

-- All-client grants remain External adviser only. The label is display-only.
drop function public.grant_firm_viewer_access(uuid, uuid, public.dashboard_tier);
create function public.grant_firm_viewer_access(
  _firm_id uuid,
  _user_id uuid,
  _tier public.dashboard_tier,
  _inviter_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare _id uuid; _label text;
begin
  perform app_private.assert_aal2();
  if not app_private.can_manage_client_viewers(auth.uid(), _firm_id) then
    raise exception 'You cannot manage viewers for this organisation.';
  end if;
  _label := nullif(btrim(_inviter_label), '');
  if _label is not null and (char_length(_label) > 80 or _label ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'INVALID_INVITER_LABEL' using errcode = '22023';
  end if;
  insert into public.user_roles (user_id, role) values (_user_id, 'client_viewer')
  on conflict (user_id, role) do nothing;
  insert into public.firm_viewer_access (firm_id, user_id, tier, granted_by, inviter_label)
  values (_firm_id, _user_id, _tier, auth.uid(), _label)
  on conflict (firm_id, user_id) do update
    set tier = excluded.tier,
        inviter_label = coalesce(excluded.inviter_label, public.firm_viewer_access.inviter_label),
        updated_at = now()
  returning id into _id;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm_id, 'standing_viewer_granted', 'firm', _firm_id::text,
          jsonb_build_object('user_id', _user_id, 'tier', _tier, 'scope', 'all_clients',
                             'relationship', 'external_adviser', 'inviter_label', _label));
  return _id;
end;
$$;
revoke all on function public.grant_firm_viewer_access(uuid, uuid, public.dashboard_tier, text) from public, anon;
grant execute on function public.grant_firm_viewer_access(uuid, uuid, public.dashboard_tier, text) to authenticated, service_role;

drop function public.firm_viewers(uuid);
create function public.firm_viewers(_firm_id uuid)
returns table(
  id uuid, user_id uuid, tier public.dashboard_tier, inviter_label text,
  created_at timestamptz, email text, display_name text
)
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
    select fva.id, fva.user_id, fva.tier, fva.inviter_label, fva.created_at,
           u.email::text, p.display_name
    from public.firm_viewer_access fva
    left join auth.users u on u.id = fva.user_id
    left join public.profiles p on p.id = fva.user_id
    where fva.firm_id = _firm_id;
end;
$$;
revoke all on function public.firm_viewers(uuid) from public, anon;
grant execute on function public.firm_viewers(uuid) to authenticated, service_role;

drop function public.firm_member_invites(uuid);
create function public.firm_member_invites(_firm_id uuid)
returns table(
  id uuid, email text, role public.firm_member_role, inviter_label text,
  expires_at timestamptz, created_at timestamptz, invited_by uuid
)
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
    select i.id, i.email, i.role, i.inviter_label, i.expires_at, i.created_at, i.invited_by
    from public.access_invites i
    where i.firm_id = _firm_id and i.accepted_at is null and i.kind = 'member'
    order by i.created_at desc;
end;
$$;
revoke all on function public.firm_member_invites(uuid) from public, anon;
grant execute on function public.firm_member_invites(uuid) to authenticated, service_role;

drop function public.firm_viewer_invites(uuid);
create function public.firm_viewer_invites(_firm_id uuid)
returns table(
  id uuid, email text, scope text, tier public.dashboard_tier,
  relationship public.client_access_relationship, inviter_label text,
  client_ids uuid[], expires_at timestamptz, created_at timestamptz, invited_by uuid
)
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
    select i.id, i.email, i.scope, i.tier, i.relationship, i.inviter_label,
           i.client_ids, i.expires_at, i.created_at, i.invited_by
    from public.access_invites i
    where i.firm_id = _firm_id and i.kind = 'viewer' and i.accepted_at is null
    order by i.created_at desc;
end;
$$;
revoke all on function public.firm_viewer_invites(uuid) from public, anon;
grant execute on function public.firm_viewer_invites(uuid) to authenticated, service_role;

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
  if v.relationship = 'business_owner' and v.scope <> 'selected' then
    raise exception 'BUSINESS_OWNER_REQUIRES_SELECTED_CLIENTS' using errcode = '22023';
  end if;

  insert into public.user_roles (user_id, role) values (_user_id, 'client_viewer')
  on conflict (user_id, role) do nothing;

  if v.scope = 'all_clients' then
    insert into public.firm_viewer_access (firm_id, user_id, tier, granted_by, inviter_label)
    values (v.firm_id, _user_id, v.tier, v.invited_by, v.inviter_label)
    on conflict (firm_id, user_id) do update
      set tier = excluded.tier,
          inviter_label = coalesce(excluded.inviter_label, public.firm_viewer_access.inviter_label),
          updated_at = now();
  else
    select coalesce(array_agg(c.id), '{}'::uuid[]) into v_ids
    from public.clients c
    where c.id = any(v.client_ids) and c.firm_id = v.firm_id;

    v_count := coalesce(array_length(v_ids, 1), 0);
    if v_count = 0 then
      raise exception 'VIEWER_INVITE_NO_CLIENTS' using errcode = '22023';
    end if;

    insert into public.client_access (client_id, user_id, tier, relationship, inviter_label)
    select cid, _user_id, v.tier::text, v.relationship, v.inviter_label
    from unnest(v_ids) as cid
    on conflict (client_id, user_id) do update
      set tier = excluded.tier,
          relationship = excluded.relationship,
          inviter_label = coalesce(excluded.inviter_label, public.client_access.inviter_label);
  end if;

  update public.access_invites set accepted_at = now() where id = v.id;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (_user_id, v.firm_id, 'viewer_invite_accepted', 'firm', v.firm_id::text,
          jsonb_build_object('email', v.email, 'scope', v.scope, 'tier', v.tier,
                             'relationship', v.relationship, 'inviter_label', v.inviter_label,
                             'client_count', case when v.scope = 'all_clients' then null else v_count end));

  return jsonb_build_object('scope', v.scope, 'tier', v.tier,
                            'relationship', v.relationship, 'client_count', v_count);
end;
$$;
revoke all on function public.apply_viewer_invite(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_viewer_invite(uuid, uuid) to service_role;