create or replace function public.xero_error_breakdown(_days integer default 7)
returns table (
  firm_id uuid,
  firm_name text,
  tenant_name text,
  path text,
  http_status integer,
  occurrences bigint,
  rate_limited bigint,
  first_seen timestamptz,
  last_seen timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();

  return query
  select e.firm_id,
         f.name,
         coalesce(e.tenant_name, 'Unattributed'),
         e.path,
         e.http_status,
         sum(e.occurrences)::bigint,
         sum(case when e.http_status = 429 then e.occurrences else 0 end)::bigint,
         min(e.first_seen),
         max(e.last_seen)
    from public.xero_api_errors e
    left join public.firms f on f.id = e.firm_id
   where e.last_seen > now() - make_interval(days => greatest(1, least(90, coalesce(_days, 7))))
   group by e.firm_id, f.name, coalesce(e.tenant_name, 'Unattributed'), e.path, e.http_status
   order by sum(e.occurrences) desc;
end;
$function$;

revoke execute on function public.xero_error_breakdown(integer) from public, anon;
grant execute on function public.xero_error_breakdown(integer) to authenticated;