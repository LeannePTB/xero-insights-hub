-- a. shares_firm_with: only active memberships count on both sides.
create or replace function app_private.shares_firm_with(_viewer uuid, _subject uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case when auth.uid() is not null and _viewer is distinct from auth.uid() then false else (
  select exists (
    select 1
    from public.firm_members vm
    join public.firm_members sm on sm.firm_id = vm.firm_id
    where vm.user_id = _viewer and vm.status = 'active'
      and sm.user_id = _subject and sm.status = 'active'
  )
  ) end
$function$;

-- b1. xero_tenant_already_linked: only ever called through service_role.
revoke execute on function public.xero_tenant_already_linked(uuid, text) from authenticated;
revoke execute on function public.xero_tenant_already_linked(uuid, text) from anon;
revoke execute on function public.xero_tenant_already_linked(uuid, text) from public;

-- b2. xero_missing_scopes: called from the caller's own session, so guard it.
create or replace function public.xero_missing_scopes(_connection_id uuid)
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when auth.uid() is not null and not exists (
      select 1 from public.xero_connections c
      where c.id = _connection_id
        and c.firm_id is not null
        and (
          app_private.has_firm_access(auth.uid(), c.firm_id)
          or app_private.platform_staff_can_access_firm(auth.uid(), c.firm_id)
        )
    ) then null
    else (
      select coalesce(array_agg(req), '{}')
      from unnest(public.xero_required_scopes()) as req
      where not exists (
        select 1 from public.xero_connections c,
                      unnest(string_to_array(coalesce(c.scopes,''), ' ')) as granted
        where c.id = _connection_id and granted = req
      )
    )
  end
$function$;

revoke execute on function public.xero_missing_scopes(uuid) from anon;
revoke execute on function public.xero_missing_scopes(uuid) from public;
grant execute on function public.xero_missing_scopes(uuid) to authenticated;