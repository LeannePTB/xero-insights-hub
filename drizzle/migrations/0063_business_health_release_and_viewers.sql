-- Owner 16 Oct: Business Health release switch (System Administrator, audited AAL2)
-- and the caller-scoped visibility predicate (practice + Viewers; Business Owners
-- only once released). Presentation gate only: never widens client data access,
-- which still requires user_can_read_client and the card's own widget check.
ALTER TABLE public.platform_branding
  ADD COLUMN IF NOT EXISTS business_health_released boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.business_health_released()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then return false; end if;
  return coalesce((select b.business_health_released from public.platform_branding b where b.id = true), false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_business_health_release(_released boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _old boolean;
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  if _released is null then raise exception 'INVALID_INPUT' using errcode = 'check_violation'; end if;
  select business_health_released into _old from public.platform_branding where id = true for update;
  if not found then raise exception 'NO_SETTINGS_ROW' using errcode = 'no_data_found'; end if;
  update public.platform_branding
     set business_health_released = _released, updated_at = now(), updated_by = auth.uid()
   where id = true;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'platform_setting_changed', 'platform_setting', 'business_health_released',
          jsonb_build_object('field', 'business_health_released', 'from', coalesce(_old, false), 'to', _released));
end;
$function$;

-- Who may see the Business Health card/badge for one client (caller-scoped).
CREATE OR REPLACE FUNCTION public.me_can_see_business_health(_client_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _uid uuid := auth.uid();
begin
  perform app_private.assert_aal2();
  if _uid is null or _client_id is null then return false; end if;
  if not app_private.user_can_read_client(_uid, _client_id) then return false; end if;
  -- Practice (organisation members, Traction Advisory team, System Administrators via their normal client access).
  if app_private.user_can_write_client(_uid, _client_id) then return true; end if;
  if coalesce((select b.business_health_released from public.platform_branding b where b.id = true), false) then return true; end if;
  -- Not released: Business Owners stay excluded; Viewers (incl. external advisers) may see it.
  if exists (select 1 from public.client_access ca
              where ca.client_id = _client_id and ca.user_id = _uid
                and ca.relationship = 'business_owner') then
    return false;
  end if;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.me_business_health_clients(_client_ids uuid[])
 RETURNS uuid[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null or _client_ids is null then return '{}'::uuid[]; end if;
  if cardinality(_client_ids) > 500 then raise exception 'TOO_MANY_CLIENTS' using errcode = 'check_violation'; end if;
  return coalesce(array(select distinct x from unnest(_client_ids) x where public.me_can_see_business_health(x)), '{}'::uuid[]);
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.business_health_released() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_business_health_release(boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.me_can_see_business_health(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.me_business_health_clients(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_health_released() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_business_health_release(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.me_can_see_business_health(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.me_business_health_clients(uuid[]) TO authenticated;
