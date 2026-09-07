create or replace function public.client_allowed_widgets(_client_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is not null
               and not app_private.user_can_read_client(auth.uid(), _client_id)
          then '{}'::text[] else (
  with ent as (select tier::text as tier from public.client_entitlement(_client_id)),
  fm as (select firm_id from public.clients where id = _client_id),
  ceiling as (
    select coalesce(pl.widgets,'{}'::text[])
        || case when public.firm_has_wip((select firm_id from fm))
                then coalesce((select w.widgets from public.plan_levels w
                                where w.scope='dashboard' and w.key='wip' and w.enabled),'{}'::text[])
                else '{}'::text[] end as w
    from ent left join public.plan_levels pl
      on pl.scope='dashboard' and pl.key = ent.tier and pl.enabled
  ),
  base as (
    select coalesce(
      (select twc.excluded_widgets from public.tier_widget_config twc
        where twc.client_id is null and twc.firm_id = (select firm_id from fm)
          and twc.tier = (select tier from ent)),
      (select twc.excluded_widgets from public.tier_widget_config twc
        where twc.client_id is null and twc.firm_id is null
          and twc.tier = (select tier from ent)),
      '{}'::text[]) as w
  ),
  excluded as (
    select (select b.w from base b)
        || coalesce((select twc.excluded_widgets from public.tier_widget_config twc
                      where twc.client_id = _client_id
                        and twc.tier = (select tier from ent)), '{}'::text[]) as w
  )
  select coalesce(array(
    select distinct x from unnest((select c.w from ceiling c)) as x
    except
    select e from unnest((select ex.w from excluded ex)) as e
  ),'{}'::text[])
  ) end
$$;

revoke execute on function app_private.get_tier_widgets(uuid, public.dashboard_tier) from public;
revoke execute on function app_private.get_tier_widgets(uuid, public.dashboard_tier) from anon;
revoke execute on function app_private.get_tier_widgets(uuid, public.dashboard_tier) from authenticated;