CREATE OR REPLACE FUNCTION public.set_client_gst_method(_client_id uuid, _method text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare _old text; _uid uuid := auth.uid();
begin
  perform app_private.assert_aal2();
  if _uid is null or _client_id is null then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;
  if _method is null or _method not in ('xero', 'cash', 'accrual') then
    raise exception 'INVALID_INPUT' using errcode = 'check_violation';
  end if;
  -- Organisation team only (owner/staff/practice member); never Business
  -- Owners, Viewers or support grants.
  if not app_private.user_can_write_client(_uid, _client_id) then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;
  select coalesce(basis_overrides->>'gst_method', 'xero') into _old from public.clients where id = _client_id for update;
  if not found then raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege'; end if;
  update public.clients
     set basis_overrides = case when _method = 'xero'
                                then coalesce(basis_overrides, '{}'::jsonb) - 'gst_method'
                                else coalesce(basis_overrides, '{}'::jsonb) || jsonb_build_object('gst_method', _method) end
   where id = _client_id;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (_uid, 'client_setting_changed', 'client', _client_id::text,
          jsonb_build_object('field', 'gst_method', 'from', _old, 'to', _method));
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.set_client_gst_method(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_client_gst_method(uuid, text) TO authenticated;