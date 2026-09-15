-- Audited record of a "View as" preview.
--
-- View As is a presentation filter: the preview renders through the caller's
-- own session and RLS, so it can never show data the caller could not already
-- read. This function records the fact of the preview, and refuses to record
-- (and therefore refuses the preview) unless the caller has aal2, is a
-- platform super admin, AND already holds an access path to that organisation.
-- Invariant 3 holds: super_admin alone is not enough here either.
create or replace function public.record_view_as(
  _firm_id uuid,
  _client_id uuid default null,
  _mode text default 'owner'
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _client_firm uuid;
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();

  if _firm_id is null then
    raise exception 'INVALID_ORGANISATION' using errcode = 'check_violation';
  end if;
  if coalesce(_mode,'') not in ('owner','client') then
    raise exception 'INVALID_MODE' using errcode = 'check_violation';
  end if;

  -- Never a grant: the caller must already reach this organisation.
  if not (
    public.has_firm_access(auth.uid(), _firm_id)
    or public.platform_staff_can_access_firm(auth.uid(), _firm_id)
  ) then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;

  if _client_id is not null then
    select c.firm_id into _client_firm from public.clients c where c.id = _client_id;
    if _client_firm is null or _client_firm <> _firm_id then
      raise exception 'CLIENT_NOT_IN_ORGANISATION' using errcode = 'check_violation';
    end if;
    if not public.has_client_read_access(auth.uid(), _client_id) then
      raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
    end if;
  end if;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (
    auth.uid(),
    _firm_id,
    'view_as_started',
    case when _client_id is null then 'firm' else 'client' end,
    coalesce(_client_id::text, _firm_id::text),
    jsonb_build_object('mode', _mode, 'firm_id', _firm_id, 'client_id', _client_id, 'at', now())
  );
end;
$function$;

revoke execute on function public.record_view_as(uuid, uuid, text) from public, anon;
grant execute on function public.record_view_as(uuid, uuid, text) to authenticated;

-- Xero API failures grouped per organisation and per Xero file, for the
-- security and monitoring section. Path C platform metadata: super admin only,
-- telemetry only, no tokens, payloads or client data.
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
language sql
stable
security definer
set search_path to 'public'
as $function$
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
     and app_private.assert_aal2() is null
     and public.me_is_super_admin()
   group by e.firm_id, f.name, coalesce(e.tenant_name, 'Unattributed'), e.path, e.http_status
   order by sum(e.occurrences) desc
$function$;

revoke execute on function public.xero_error_breakdown(integer) from public, anon;
grant execute on function public.xero_error_breakdown(integer) to authenticated;