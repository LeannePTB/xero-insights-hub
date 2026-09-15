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

  -- Never a grant: the caller must already reach this organisation by another
  -- path. Invariant 3 — super_admin alone is not enough here either.
  if not (
    app_private.has_firm_access(auth.uid(), _firm_id)
    or app_private.platform_staff_can_access_firm(auth.uid(), _firm_id)
  ) then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;

  if _client_id is not null then
    select c.firm_id into _client_firm from public.clients c where c.id = _client_id;
    if _client_firm is null or _client_firm <> _firm_id then
      raise exception 'CLIENT_NOT_IN_ORGANISATION' using errcode = 'check_violation';
    end if;
    if not app_private.has_client_read_access(auth.uid(), _client_id) then
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