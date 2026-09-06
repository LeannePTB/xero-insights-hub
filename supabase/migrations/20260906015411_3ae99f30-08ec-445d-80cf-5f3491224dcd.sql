-- Caller-identity guard. Each function keeps its name, arguments, return type,
-- volatility, language and search_path. The only change is the leading guard:
--   auth.uid() is not null and _user_id is distinct from auth.uid()  ->  false/null
-- service_role / postgres have no JWT, so auth.uid() is null and they pass through.

create or replace function app_private.firm_support_access_active(_user_id uuid, _firm_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
  select exists (
    select 1 from public.firm_support_access fsa
    where fsa.firm_id = _firm_id
      and fsa.grantee_user_id = _user_id
      and fsa.granted = true
      and fsa.revoked_at is null
      and fsa.expires_at > now()
  )
  ) end
$function$;

create or replace function app_private.get_user_firm_id(_user_id uuid)
 returns uuid language sql stable security definer set search_path to 'public'
as $function$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then null::uuid else (
  select firm_id from public.firm_members
  where user_id = _user_id and status = 'active'
  order by created_at
  limit 1
  ) end
$function$;

create or replace function app_private.get_user_tier(_user_id uuid, _tenant_id text)
 returns dashboard_tier language sql stable security definer set search_path to 'public'
as $function$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then null::public.dashboard_tier else ((
  SELECT ca.tier
  FROM public.client_access ca
  JOIN public.client_xero_orgs cxo ON cxo.client_id = ca.client_id
  JOIN public.xero_connections xc ON xc.id = cxo.xero_connection_id
  WHERE ca.user_id = _user_id AND xc.tenant_id = _tenant_id
  ORDER BY CASE ca.tier WHEN 'investigate' THEN 3 WHEN 'advisory' THEN 2 ELSE 1 END DESC
  LIMIT 1
  )::public.dashboard_tier) end
$function$;

create or replace function app_private.has_client_access(_user_id uuid, _client_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$ select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (SELECT EXISTS (SELECT 1 FROM public.client_access WHERE user_id = _user_id AND client_id = _client_id)) end $function$;

create or replace function app_private.has_firm_access(_user_id uuid, _firm_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
  select exists (
    select 1 from public.firm_members
    where user_id = _user_id and firm_id = _firm_id and status = 'active'
  )
  ) end
$function$;

create or replace function app_private.has_role(_user_id uuid, _role app_role)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$ select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)) end $function$;

create or replace function app_private.has_tenant_access(_user_id uuid, _tenant_id text)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
  SELECT EXISTS (
    SELECT 1
    FROM public.client_access ca
    JOIN public.client_xero_orgs cxo ON cxo.client_id = ca.client_id
    JOIN public.xero_connections xc ON xc.id = cxo.xero_connection_id
    WHERE ca.user_id = _user_id AND xc.tenant_id = _tenant_id
  )
  ) end
$function$;

create or replace function app_private.is_advisor(_user_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$ select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'advisor')) end $function$;

create or replace function app_private.is_firm_owner(_user_id uuid, _firm_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
  select exists (
    select 1 from public.firm_members
    where user_id = _user_id and firm_id = _firm_id
      and role = 'owner' and status = 'active'
  )
  ) end
$function$;

create or replace function app_private.is_org_owner(_user_id uuid, _firm_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
  select exists (select 1 from public.firms f
                 where f.id = _firm_id and f.owner_user_id = _user_id)
      or app_private.is_firm_owner(_user_id, _firm_id)
  ) end
$function$;

create or replace function app_private.is_super_admin(_user_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$ select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')) end $function$;

create or replace function app_private.platform_staff_can_access_firm(_user_id uuid, _firm_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
  select _firm_id is not null
     and app_private.is_super_admin(_user_id)
     and app_private.firm_support_access_active(_user_id, _firm_id)
  ) end
$function$;

create or replace function app_private.shares_firm_with(_viewer uuid, _subject uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select case when auth.uid() is not null and _viewer is distinct from auth.uid() then false else (
  SELECT EXISTS (
    SELECT 1
    FROM public.firm_members vm
    JOIN public.firm_members sm ON sm.firm_id = vm.firm_id
    WHERE vm.user_id = _viewer AND sm.user_id = _subject
  )
  ) end
$function$;

create or replace function app_private.user_can_access_tenant(_user_id uuid, _tenant_id text)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
  select exists (
    select 1 from app_private.firm_ids_for_tenant(_tenant_id) as f(firm_id)
    where app_private.has_firm_access(_user_id, f.firm_id)
       or app_private.platform_staff_can_access_firm(_user_id, f.firm_id)
  )
  ) end
$function$;

create or replace function app_private.user_can_manage_client(_user_id uuid, _client_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = _client_id
      AND (
        c.owner_user_id = _user_id
        OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(_user_id, c.firm_id))
        OR (
          app_private.is_super_admin(_user_id)
          AND app_private.platform_staff_can_access_firm(_user_id, c.firm_id)
        )
      )
  )
  ) end
$function$;

create or replace function app_private.user_can_read_client(_user_id uuid, _client_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
  SELECT app_private.user_can_manage_client(_user_id, _client_id)
      OR app_private.has_client_access(_user_id, _client_id)
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = _client_id
          AND c.firm_id IS NOT NULL
          AND app_private.has_firm_access(_user_id, c.firm_id)
      )
  ) end
$function$;

create or replace function public.user_can_access_client(_user_id uuid, _client_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
  select exists (
    select 1 from public.clients c
    where c.id = _client_id
      and (public.user_can_access_firm(_user_id, c.firm_id)
        or app_private.has_client_access(_user_id, c.id))
  )
  ) end
$function$;

create or replace function public.user_can_access_firm(_user_id uuid, _firm_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
  select _user_id is not null and _firm_id is not null
     and (app_private.has_firm_access(_user_id, _firm_id)
       or app_private.platform_staff_can_access_firm(_user_id, _firm_id))
  ) end
$function$;