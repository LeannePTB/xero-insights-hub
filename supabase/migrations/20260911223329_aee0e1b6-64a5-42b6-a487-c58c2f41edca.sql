CREATE OR REPLACE FUNCTION public.admin_set_super_admin(_user_id uuid, _make boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  if _make then
    insert into public.user_roles (user_id, role) values (_user_id, 'super_admin')
    on conflict (user_id, role) do nothing;
    return true;
  end if;
  if _user_id = auth.uid() then
    raise exception 'You can''t remove your own super admin access.';
  end if;
  if not exists (
    select 1 from public.user_roles r where r.role = 'super_admin' and r.user_id <> _user_id
  ) then
    raise exception 'At least one super admin must remain.';
  end if;
  delete from public.user_roles r where r.user_id = _user_id and r.role = 'super_admin';
  return false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_firm_members(_firm_id uuid)
 RETURNS TABLE(id uuid, user_id uuid, role text, status text, created_at timestamp with time zone, email text, display_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  return query
    select fm.id, fm.user_id, fm.role::text, fm.status, fm.created_at,
           u.email::text, p.display_name
    from public.firm_members fm
    left join auth.users u on u.id = fm.user_id
    left join public.profiles p on p.id = fm.user_id
    where fm.firm_id = _firm_id
    order by fm.created_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.plan_level_usage_count(_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_scope text;
  v_key text;
  v_count integer;
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  select pl.scope, pl.key into v_scope, v_key from public.plan_levels pl where pl.id = _id;
  if v_scope is null then
    raise exception 'Level not found.';
  end if;
  if v_scope = 'firm' then
    select count(*) into v_count from public.subscriptions s where s.tier = v_key;
  else
    select count(*) into v_count from public.client_access ca where ca.tier = v_key;
  end if;
  return coalesce(v_count, 0);
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_set_super_admin(uuid, boolean) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_firm_members(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.plan_level_usage_count(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_super_admin(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_firm_members(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_level_usage_count(uuid) TO authenticated, service_role;