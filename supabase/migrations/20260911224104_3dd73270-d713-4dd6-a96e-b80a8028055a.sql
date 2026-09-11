-- 1. The caller's own roles.
create or replace function public.my_roles()
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare v text[];
begin
  perform app_private.assert_aal2();
  select coalesce(array_agg(ur.role::text order by ur.role::text), '{}')
    into v
    from public.user_roles ur
   where ur.user_id = auth.uid();
  return v;
end;
$$;
revoke all on function public.my_roles() from public, anon;
grant execute on function public.my_roles() to authenticated;

-- 2. The caller's own active organisation memberships, oldest first.
create or replace function public.my_firm_memberships()
returns table(firm_id uuid, role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  return query
    select fm.firm_id, fm.role::text, fm.created_at
      from public.firm_members fm
     where fm.user_id = auth.uid()
       and fm.status = 'active'
     order by fm.created_at;
end;
$$;
revoke all on function public.my_firm_memberships() from public, anon;
grant execute on function public.my_firm_memberships() to authenticated;

-- 3. The caller's own client viewer grants.
create or replace function public.my_client_access()
returns table(id uuid, client_id uuid, client_name text, tier text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  return query
    select ca.id, ca.client_id, c.name, ca.tier::text
      from public.client_access ca
      join public.clients c on c.id = ca.client_id
     where ca.user_id = auth.uid()
     order by c.name;
end;
$$;
revoke all on function public.my_client_access() from public, anon;
grant execute on function public.my_client_access() to authenticated;

-- 4a. Support grants for one organisation. Read-only listing. Visible to the
-- organisation's owner, its active members, the named grantee, or a super admin
-- (who needs to see whether they already have an open request). Being a super
-- admin grants no client data here — only this request metadata.
create or replace function public.firm_support_grants(_firm_id uuid)
returns table(
  id uuid,
  grantee_user_id uuid,
  grantee_name text,
  grantee_email text,
  granted boolean,
  granted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  granted_by uuid,
  granted_by_name text,
  granted_by_email text,
  reason text,
  note text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  if not (
    exists (select 1 from public.firms f where f.id = _firm_id and f.owner_user_id = auth.uid())
    or exists (
      select 1 from public.firm_members fm
       where fm.firm_id = _firm_id and fm.user_id = auth.uid() and fm.status = 'active'
    )
    or exists (
      select 1 from public.firm_support_access fsa
       where fsa.firm_id = _firm_id and fsa.grantee_user_id = auth.uid()
    )
    or app_private.me_is_super_admin()
  ) then
    raise exception 'You cannot view support access for this organisation.';
  end if;

  return query
    select fsa.id,
           fsa.grantee_user_id,
           gp.display_name,
           gu.email::text,
           fsa.granted,
           fsa.granted_at,
           fsa.revoked_at,
           fsa.expires_at,
           fsa.granted_by,
           bp.display_name,
           bu.email::text,
           fsa.reason,
           fsa.note,
           fsa.created_at
      from public.firm_support_access fsa
      left join auth.users gu on gu.id = fsa.grantee_user_id
      left join public.profiles gp on gp.id = fsa.grantee_user_id
      left join auth.users bu on bu.id = fsa.granted_by
      left join public.profiles bp on bp.id = fsa.granted_by
     where fsa.firm_id = _firm_id
     order by fsa.created_at desc;
end;
$$;
revoke all on function public.firm_support_grants(uuid) from public, anon;
grant execute on function public.firm_support_grants(uuid) to authenticated;

-- 4b. The caller's own relationship to one organisation. Discloses nothing
-- about anybody else.
create or replace function public.firm_support_viewer_state(_firm_id uuid)
returns table(
  is_owner boolean,
  is_member boolean,
  is_super_admin boolean,
  is_platform_staff boolean,
  has_client_data boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_super boolean;
  v_advisor boolean;
begin
  perform app_private.assert_aal2();
  v_super := app_private.me_is_super_admin();
  v_advisor := exists (
    select 1 from public.user_roles ur
     where ur.user_id = auth.uid() and ur.role = 'advisor'::app_role
  );
  return query
    select
      exists (select 1 from public.firms f where f.id = _firm_id and f.owner_user_id = auth.uid()),
      exists (
        select 1 from public.firm_members fm
         where fm.firm_id = _firm_id and fm.user_id = auth.uid() and fm.status = 'active'
      ),
      v_super,
      (v_super or v_advisor),
      public.user_can_access_firm(auth.uid(), _firm_id);
end;
$$;
revoke all on function public.firm_support_viewer_state(uuid) from public, anon;
grant execute on function public.firm_support_viewer_state(uuid) to authenticated;