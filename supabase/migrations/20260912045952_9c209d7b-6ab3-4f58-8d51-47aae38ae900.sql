CREATE OR REPLACE FUNCTION public.remove_firm_member(_firm_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
  v_target_status text;
  v_active_members integer;
begin
  perform app_private.assert_aal2();

  if v_caller is null then
    raise exception 'NOT_AUTHENTICATED' using errcode='insufficient_privilege';
  end if;
  if _firm_id is null or _user_id is null then
    raise exception 'NOT_PERMITTED' using errcode='insufficient_privilege';
  end if;

  -- The caller must hold an ACTIVE membership of THIS organisation. A support
  -- grant is not a membership (PK 5: support is read-only), and the super_admin
  -- role on its own grants nothing here (PK 3).
  select fm.role::text into v_caller_role
    from public.firm_members fm
   where fm.firm_id = _firm_id and fm.user_id = v_caller and fm.status = 'active';
  if v_caller_role is null then
    raise exception 'NOT_A_MEMBER' using errcode='insufficient_privilege';
  end if;

  select fm.role::text, fm.status into v_target_role, v_target_status
    from public.firm_members fm
   where fm.firm_id = _firm_id and fm.user_id = _user_id
   for update;
  if v_target_role is null or v_target_status is distinct from 'active' then
    raise exception 'NOT_A_MEMBER_TARGET' using errcode='no_data_found';
  end if;

  if _user_id = v_caller then
    -- Leaving. An owner must hand ownership over first.
    if v_caller_role = 'owner' then
      raise exception 'OWNER_MUST_TRANSFER' using errcode='check_violation';
    end if;
  else
    -- Removing someone else: owner only, and staff only. No path removes an owner.
    if v_caller_role <> 'owner' or v_target_role <> 'staff' then
      raise exception 'NOT_PERMITTED' using errcode='insufficient_privilege';
    end if;
  end if;

  select count(*) into v_active_members
    from public.firm_members fm
   where fm.firm_id = _firm_id and fm.status = 'active';
  if v_active_members <= 1 then
    raise exception 'LAST_MEMBER' using errcode='check_violation';
  end if;

  update public.firm_members
     set status = 'removed', updated_at = now()
   where firm_id = _firm_id and user_id = _user_id;

  insert into public.audit_log (action, firm_id, actor_user_id, target_type, target_id, meta)
  values ('firm_member_removed', _firm_id, v_caller, 'firm_member', _user_id::text,
          jsonb_build_object('firm_id', _firm_id, 'user_id', _user_id,
                             'previous_role', v_target_role,
                             'previous_status', v_target_status,
                             'self_removal', _user_id = v_caller));
end;
$function$;

REVOKE ALL ON FUNCTION public.remove_firm_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_firm_member(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.remove_firm_member(uuid, uuid) TO authenticated;