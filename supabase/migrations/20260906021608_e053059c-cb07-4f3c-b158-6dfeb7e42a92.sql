CREATE OR REPLACE FUNCTION app_private.firm_subscription_lapsed(_firm_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when auth.uid() is not null
               and not public.user_can_access_firm(auth.uid(), _firm_id)
               and not app_private.is_super_admin(auth.uid())
          then false else (
  select case
    -- Positive Traction's own organisation is never charged and never lapses.
    when exists (select 1 from public.firms f where f.id=_firm_id and f.is_always_free) then false
    else exists (
      select 1 from public.subscriptions s
      where s.firm_id = _firm_id
        and (
          (s.status = 'trialing' and s.trial_ends_at is not null and s.trial_ends_at < now())
          or s.status in ('canceled','unpaid','incomplete_expired')
          or (s.status = 'past_due' and s.current_period_end is not null
              and s.current_period_end < now())
        )
    )
  end
  ) end
$function$;

CREATE OR REPLACE FUNCTION public.firm_has_wip(_firm_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when auth.uid() is not null
               and not public.user_can_access_firm(auth.uid(), _firm_id)
               and not app_private.is_super_admin(auth.uid())
          then false else (
  select exists (
    select 1 from public.subscriptions s
    where s.firm_id = _firm_id and s.wip_enabled
  )
  ) end
$function$;

CREATE OR REPLACE FUNCTION public.firm_has_consolidation(_firm_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when auth.uid() is not null
               and not public.user_can_access_firm(auth.uid(), _firm_id)
               and not app_private.is_super_admin(auth.uid())
          then false else (
  select exists (
    select 1 from public.subscriptions s
    where s.firm_id = _firm_id and s.consolidation_enabled
  ) and not app_private.firm_subscription_lapsed(_firm_id)
  ) end
$function$;

CREATE OR REPLACE FUNCTION public.firm_allowed_widgets(_firm_id uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when auth.uid() is not null
               and not public.user_can_access_firm(auth.uid(), _firm_id)
               and not app_private.is_super_admin(auth.uid())
          then '{}'::text[] else (
  select coalesce(array(
    select w from unnest(public.org_addon_widgets()) as w
     where public.firm_has_consolidation(_firm_id)
    union
    select distinct w2
      from public.clients c
      cross join lateral unnest(public.client_allowed_widgets(c.id)) as w2
     where c.firm_id = _firm_id
       and not (w2 = any(public.org_addon_widgets()))
  ), '{}'::text[])
  ) end
$function$;

CREATE OR REPLACE FUNCTION public.firm_can_use_widget(_firm_id uuid, _widget text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when auth.uid() is not null
               and not public.user_can_access_firm(auth.uid(), _firm_id)
               and not app_private.is_super_admin(auth.uid())
          then false else (
  select _widget = any(public.firm_allowed_widgets(_firm_id))
  ) end
$function$;

CREATE OR REPLACE FUNCTION public.firm_plan_limits(_firm_id uuid)
 RETURNS TABLE(client_limit integer, xero_org_limit integer, clients_used integer, xero_files_used integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select l.client_limit,
         l.xero_org_limit,
         (select count(*)::int from public.clients c where c.firm_id = _firm_id),
         (select count(distinct xc.tenant_id)::int from public.xero_connections xc
           where xc.firm_id = _firm_id
             and coalesce(xc.status,'connected') <> 'disconnected'
             and xc.tenant_id is not null)
  from app_private.firm_limits(_firm_id) l
  where auth.uid() is null
     or public.user_can_access_firm(auth.uid(), _firm_id)
     or app_private.is_super_admin(auth.uid())
$function$;

CREATE OR REPLACE FUNCTION public.firm_subscription_state(_firm_id uuid)
 RETURNS TABLE(plan_key text, plan_label text, status text, lapsed boolean, always_free boolean, ends_at timestamp with time zone, days_remaining integer, ending_soon boolean, consolidation boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
  select
    s.tier,
    pl.label,
    s.status::text,
    app_private.firm_subscription_lapsed(_firm_id),
    coalesce(f.is_always_free,false),
    ends.at,
    case when ends.at is null then null
         else greatest(0, (ends.at::date - current_date)) end,
    case when f.is_always_free then false
         when ends.at is null then false
         else ends.at > now() and ends.at < now() + interval '14 days' end,
    public.firm_has_consolidation(_firm_id)
  from public.firms f
  left join public.subscriptions s on s.firm_id = f.id
  left join public.plan_levels pl on pl.scope='firm' and pl.key = s.tier
  cross join lateral (
    select case when s.status = 'trialing' then s.trial_ends_at
                else s.current_period_end end as at
  ) ends
  where f.id = _firm_id
    and (auth.uid() is null
      or public.user_can_access_firm(auth.uid(), _firm_id)
      or app_private.is_super_admin(auth.uid()))
$function$;