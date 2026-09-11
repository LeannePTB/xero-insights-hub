create or replace function public.firm_member_invites(_firm_id uuid)
returns table (
  id uuid,
  email text,
  role public.firm_member_role,
  expires_at timestamptz,
  created_at timestamptz,
  invited_by uuid
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
  select i.id, i.email, i.role, i.expires_at, i.created_at, i.invited_by
  from public.access_invites i
  where i.firm_id = _firm_id
    and i.accepted_at is null
  order by i.created_at desc;
end;
$$;

revoke execute on function public.firm_member_invites(uuid) from public, anon;
grant execute on function public.firm_member_invites(uuid) to authenticated, service_role;

create or replace function public.revoke_firm_member_invite(_id uuid)
returns void
language plpgsql
volatile
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

  select * into v_invite from public.access_invites where id = _id;
  if v_invite.id is null then
    raise exception 'INVITE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'INVITE_ALREADY_ACCEPTED' using errcode = '22023';
  end if;

  delete from public.access_invites where id = _id;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (
    auth.uid(),
    v_invite.firm_id,
    'firm_invite_revoked',
    'firm',
    v_invite.firm_id::text,
    jsonb_build_object('email', v_invite.email, 'role', v_invite.role)
  );
end;
$$;

revoke execute on function public.revoke_firm_member_invite(uuid) from public, anon;
grant execute on function public.revoke_firm_member_invite(uuid) to authenticated, service_role;