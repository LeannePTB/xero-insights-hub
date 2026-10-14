CREATE OR REPLACE FUNCTION public.overview_hidden_items()
 RETURNS TABLE(kind text, id uuid, name text, firm_id uuid, firm_name text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then return; end if;
  return query
    select 'client'::text, c.id, c.name, f.id, f.name
      from public.clients c join public.firms f on f.id = c.firm_id
     where c.overview_hidden and not f.overview_hidden
       and public.user_can_write_client(auth.uid(), c.id)
    union all
    select 'organisation'::text, f.id, f.name, f.id, f.name
      from public.firms f
     where f.overview_hidden
       and public.user_can_write_firm(auth.uid(), f.id)
     order by 5, 3 limit 1000;
end;
$function$;