CREATE OR REPLACE FUNCTION public.overview_clients(_firm_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(client_id uuid, client_name text, firm_id uuid, firm_name text)
 LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then return; end if;
  -- "Hide from overview" tidies the all-organisations view only; an organisation's
  -- own view (_firm_id given) always lists every client the caller can read.
  return query
    select c.id, c.name, f.id, f.name
      from public.clients c
      join public.firms f on f.id = c.firm_id
     where exists (select 1 from public.firm_members fm
                    where fm.firm_id = c.firm_id and fm.user_id = auth.uid() and fm.status = 'active')
       and app_private.user_can_read_client(auth.uid(), c.id)
       and (_firm_id is null or c.firm_id = _firm_id)
       and (_firm_id is not null or (not c.overview_hidden and not f.overview_hidden))
     order by f.name, c.name
     limit 1000;
end;
$function$;