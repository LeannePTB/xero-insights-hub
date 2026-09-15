create or replace function public.admin_assert_can_sign_out_user(_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_super_admin_count int;
  v_target_is_super boolean;
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'Forbidden';
  end if;
  if _user_id is null then
    raise exception 'Forbidden';
  end if;
  if _user_id = auth.uid() then
    raise exception 'Use Sign out my other devices for your own account';
  end if;

  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = 'super_admin'
  ) into v_target_is_super;

  if v_target_is_super then
    select count(*) into v_super_admin_count
      from public.user_roles where role = 'super_admin';
    if v_super_admin_count <= 1 then
      raise exception 'This is the only platform admin — appoint another before signing them out of every device';
    end if;
  end if;
end;
$function$;

revoke all on function public.admin_assert_can_sign_out_user(uuid) from public, anon;
grant execute on function public.admin_assert_can_sign_out_user(uuid) to authenticated;

create or replace function public.record_sign_out_all_devices(_user_id uuid, _method text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.admin_assert_can_sign_out_user(_user_id);
  if _method not in ('credential_reset') then
    raise exception 'Unknown revocation method';
  end if;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'sessions_revoked_all', 'user', _user_id::text,
          jsonb_build_object('at', now(), 'method', _method));
end;
$function$;

revoke all on function public.record_sign_out_all_devices(uuid, text) from public, anon;
grant execute on function public.record_sign_out_all_devices(uuid, text) to authenticated;