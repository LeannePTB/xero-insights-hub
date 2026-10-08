-- Repair broken references to the existing canonical organisation write predicate.
-- No policy, grant, entitlement or authorisation rule is widened.
CREATE OR REPLACE FUNCTION public.set_firm_overview_hidden(_firm_id uuid, _hidden boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform app_private.assert_aal2();
  if not public.user_can_write_firm(auth.uid(), _firm_id) then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  update public.firms set overview_hidden = _hidden where id = _firm_id;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'firm_overview_hidden_set', 'firm', _firm_id::text,
          jsonb_build_object('hidden', _hidden));
end;
$function$;
REVOKE ALL ON FUNCTION public.set_firm_overview_hidden(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_firm_overview_hidden(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.overview_hidden_items()
RETURNS TABLE(kind text, id uuid, name text, firm_id uuid, firm_name text)
LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then return; end if;
  return query
    select 'client'::text, c.id, c.name, f.id, f.name
      from public.clients c join public.firms f on f.id = c.firm_id
     where c.overview_hidden and not f.overview_hidden
       and app_private.user_can_write_client(auth.uid(), c.id)
    union all
    select 'organisation'::text, f.id, f.name, f.id, f.name
      from public.firms f
     where f.overview_hidden
       and public.user_can_write_firm(auth.uid(), f.id)
     order by 5, 3 limit 1000;
end;
$function$;
REVOKE ALL ON FUNCTION public.overview_hidden_items() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.overview_hidden_items() TO authenticated;