create or replace function public.set_firm_default_widgets(_firm_id uuid, _widgets text[])
returns integer
language plpgsql
security definer
set search_path to 'public', 'app_private'
as $function$
declare
  _uid uuid := auth.uid();
  _count integer;
begin
  -- Membership only. No super-admin bypass; support grants are read-only.
  if _uid is null or not app_private.has_firm_access(_uid, _firm_id) then
    raise exception 'NO_ACCESS' using errcode='insufficient_privilege';
  end if;

  update public.firms set default_widgets = _widgets where id = _firm_id;

  -- One statement for every client in the organisation: intersect the client's
  -- current list with the new default, preserving the client's own order.
  -- A null current list is treated as the new default, matching the app.
  with updated as (
    update public.clients c
       set dashboard_widgets = case
             when c.dashboard_widgets is null then _widgets
             else coalesce((
               select array_agg(w order by ord)
                 from unnest(c.dashboard_widgets) with ordinality as t(w, ord)
                where w = any(_widgets)
             ), '{}'::text[])
           end
     where c.firm_id = _firm_id
    returning 1
  )
  select count(*) into _count from updated;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (_uid, _firm_id, 'org_default_widgets_saved', 'firms', _firm_id::text,
          jsonb_build_object('widgets', _widgets, 'clients_updated', _count));

  return _count;
end;
$function$;

revoke execute on function public.set_firm_default_widgets(uuid, text[]) from public, anon;
grant execute on function public.set_firm_default_widgets(uuid, text[]) to authenticated;