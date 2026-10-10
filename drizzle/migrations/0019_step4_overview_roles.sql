DROP FUNCTION IF EXISTS public.overview_clients();
CREATE FUNCTION public.overview_clients(_firm_id uuid DEFAULT NULL)
 RETURNS TABLE(client_id uuid, client_name text, firm_id uuid, firm_name text)
 LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then return; end if;
  return query
    select c.id, c.name, f.id, f.name
      from public.clients c
      join public.firms f on f.id = c.firm_id
     where exists (select 1 from public.firm_members fm
                    where fm.firm_id = c.firm_id and fm.user_id = auth.uid() and fm.status = 'active')
       and app_private.user_can_read_client(auth.uid(), c.id)
       and (_firm_id is null or c.firm_id = _firm_id)
       and not c.overview_hidden
       and not f.overview_hidden
     order by f.name, c.name
     limit 1000;
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.overview_clients(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.overview_clients(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_remove_advisor(_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform app_private.assert_aal2();
  if not exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'advisor') then
    raise exception 'Only advisors can manage advisors.';
  end if;
  if not exists (select 1 from public.user_roles r where r.role = 'advisor' and r.user_id <> _user_id) then
    raise exception 'At least one advisor must remain.';
  end if;
  if exists (select 1 from public.user_roles r where r.user_id = _user_id and r.role = 'super_admin')
     and not exists (select 1 from public.user_roles r where r.role = 'super_admin' and r.user_id <> _user_id) then
    raise exception 'At least one super admin must remain.';
  end if;
  delete from public.user_roles r where r.user_id = _user_id;
  delete from public.client_access ca where ca.user_id = _user_id;
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_remove_advisor(uuid) FROM PUBLIC, anon;

CREATE FUNCTION public.me_can_manage_client(_client_id uuid)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then return false; end if;
  return app_private.user_can_write_client(auth.uid(), _client_id);
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.me_can_manage_client(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.me_can_manage_client(uuid) TO authenticated;