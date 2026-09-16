create or replace function app_private.firm_limits(_firm_id uuid)
returns table(client_limit integer, xero_org_limit integer)
language sql
stable
security definer
set search_path = public
as $function$
  select
    coalesce((
      select o.client_limit
      from public.org_subscription_options o
      where o.firm_id = _firm_id
      limit 1
    ), 0) as client_limit,
    coalesce((
      select o.client_limit
      from public.org_subscription_options o
      where o.firm_id = _firm_id
      limit 1
    ), 0) as xero_org_limit
$function$;

revoke all on function app_private.firm_limits(uuid) from public, anon, authenticated;
grant execute on function app_private.firm_limits(uuid) to service_role;