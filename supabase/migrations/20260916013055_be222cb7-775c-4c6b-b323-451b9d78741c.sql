alter table public.org_subscription_options
  add column if not exists trial_advisory_enabled boolean not null default false,
  add column if not exists trial_consolidation_enabled boolean not null default false,
  add column if not exists trial_ends_at timestamptz;

-- Effective purchased-or-trialled options for one organisation, resolved at
-- read time. Purchased and trialled are stored separately and never merged, so
-- an expiring trial reverts to exactly what was bought.
create or replace function app_private.org_effective_options(_firm_id uuid)
returns table(
  advisory boolean,
  consolidation boolean,
  purchased_advisory boolean,
  purchased_consolidation boolean,
  trial_advisory boolean,
  trial_consolidation boolean,
  trial_ends_at timestamptz,
  trial_active boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with o as (
    select coalesce(opt.advisory_enabled, false) as p_adv,
           coalesce(opt.consolidation_enabled, false) as p_con,
           coalesce(opt.trial_advisory_enabled, false) as t_adv,
           coalesce(opt.trial_consolidation_enabled, false) as t_con,
           opt.trial_ends_at as t_end
      from public.org_subscription_options opt
     where opt.firm_id = _firm_id
  ),
  r as (
    select coalesce((select p_adv from o), false) as p_adv,
           coalesce((select p_con from o), false) as p_con,
           coalesce((select t_adv from o), false) as t_adv,
           coalesce((select t_con from o), false) as t_con,
           (select t_end from o) as t_end
  ),
  live as (
    select r.*, (r.t_end is not null and r.t_end > now()) as t_live from r
  )
  select
    (live.p_adv or (live.t_live and live.t_adv)) as advisory,
    (live.p_con or (live.t_live and live.t_con))
      and (live.p_adv or (live.t_live and live.t_adv)) as consolidation,
    live.p_adv, live.p_con, live.t_adv, live.t_con, live.t_end, live.t_live
  from live
$function$;

revoke all on function app_private.org_effective_options(uuid) from public, anon, authenticated;

-- Card availability: the organisation's effective options intersected later
-- with the client's ticked list. Unchanged apart from reading the resolver.
create or replace function app_private.client_available_cards(_client_id uuid)
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $function$
  with c as (
    select cl.firm_id from public.clients cl where cl.id = _client_id
  ),
  o as (
    select e.advisory, e.consolidation
      from app_private.org_effective_options((select firm_id from c)) e
  ),
  siblings as (
    select count(*) as n from public.clients cl where cl.firm_id = (select firm_id from c)
  ),
  lapsed as (
    select app_private.firm_subscription_lapsed((select firm_id from c)) as v
  )
  select coalesce(array(
    select distinct x from unnest(
      app_private.card_group_cards('standard')
      || case when coalesce((select advisory from o), false) and not (select v from lapsed)
              then app_private.card_group_cards('advisory') else '{}'::text[] end
      || case when coalesce((select consolidation from o), false)
                   and not (select v from lapsed)
                   and (select n from siblings) > 1
              then app_private.card_group_cards('consolidation') else '{}'::text[] end
    ) as x
    order by x
  ), '{}'::text[])
$function$;

-- Organisation purchase read, now reporting purchased and trialled separately.
drop function if exists public.org_purchase(uuid);

create or replace function public.org_purchase(_firm_id uuid)
returns table(
  firm_id uuid,
  client_limit integer,
  advisory_enabled boolean,
  consolidation_enabled boolean,
  billing_mode text,
  client_count integer,
  trial_advisory_enabled boolean,
  trial_consolidation_enabled boolean,
  trial_ends_at timestamptz,
  trial_active boolean,
  effective_advisory boolean,
  effective_consolidation boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;
  if not public.user_can_access_firm(auth.uid(), _firm_id)
     and not app_private.platform_staff_can_access_firm(auth.uid(), _firm_id)
     and not app_private.is_super_admin(auth.uid()) then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;

  return query
    select f.id,
           coalesce(o.client_limit, 0),
           coalesce(o.advisory_enabled, false),
           coalesce(o.consolidation_enabled, false),
           coalesce(o.billing_mode, 'bookkeeping'),
           (select count(*)::int from public.clients c where c.firm_id = f.id),
           coalesce(o.trial_advisory_enabled, false),
           coalesce(o.trial_consolidation_enabled, false),
           o.trial_ends_at,
           e.trial_active,
           e.advisory,
           e.consolidation
      from public.firms f
      left join public.org_subscription_options o on o.firm_id = f.id
      cross join lateral app_private.org_effective_options(f.id) e
     where f.id = _firm_id;
end;
$function$;

revoke execute on function public.org_purchase(uuid) from public, anon;
grant execute on function public.org_purchase(uuid) to authenticated;

-- Starting, extending or ending an organisation trial is a commercial change:
-- aal2 + super admin checked here, a reason required, audited, never touching
-- purchased flags or any client's ticked card list.
create or replace function public.set_org_trial(
  _firm_id uuid,
  _advisory boolean,
  _consolidation boolean,
  _ends_at timestamptz,
  _reason text
)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _prev record;
  _adv boolean := coalesce(_advisory, false);
  _con boolean := coalesce(_consolidation, false);
  _end timestamptz := _ends_at;
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();

  if _reason is null or length(btrim(_reason)) < 3 then
    raise exception 'A reason is required.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.firms f where f.id = _firm_id) then
    raise exception 'NO_SUCH_ORGANISATION' using errcode = 'no_data_found';
  end if;

  -- Ending a trial: no grants, no end date.
  if not _adv and not _con then
    _adv := false; _con := false; _end := null;
  else
    if _con and not _adv then
      raise exception 'CONSOLIDATION_REQUIRES_ADVISORY' using errcode = 'check_violation';
    end if;
    if _end is null or _end <= now() then
      raise exception 'TRIAL_END_MUST_BE_FUTURE' using errcode = 'check_violation';
    end if;
    if _end > now() + interval '120 days' then
      raise exception 'TRIAL_TOO_LONG' using errcode = 'check_violation';
    end if;
  end if;

  select coalesce(o.trial_advisory_enabled, false) as t_adv,
         coalesce(o.trial_consolidation_enabled, false) as t_con,
         o.trial_ends_at as t_end
    into _prev
    from public.org_subscription_options o
   where o.firm_id = _firm_id;

  insert into public.org_subscription_options
    (firm_id, client_limit, advisory_enabled, consolidation_enabled, billing_mode,
     trial_advisory_enabled, trial_consolidation_enabled, trial_ends_at)
  values (_firm_id, 0, false, false, 'bookkeeping', _adv, _con, _end)
  on conflict (firm_id) do update
    set trial_advisory_enabled = excluded.trial_advisory_enabled,
        trial_consolidation_enabled = excluded.trial_consolidation_enabled,
        trial_ends_at = excluded.trial_ends_at,
        updated_at = now();

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm_id,
    case when _end is null then 'org_trial_ended' else 'org_trial_set' end,
    'firm', _firm_id::text,
    jsonb_build_object(
      'reason', btrim(_reason),
      'trial_advisory', _adv,
      'trial_consolidation', _con,
      'trial_ends_at', _end,
      'previous', case when _prev is null then null else jsonb_build_object(
        'trial_advisory', _prev.t_adv,
        'trial_consolidation', _prev.t_con,
        'trial_ends_at', _prev.t_end) end));

  return _end;
end;
$function$;

revoke execute on function public.set_org_trial(uuid, boolean, boolean, timestamptz, text) from public, anon;
grant execute on function public.set_org_trial(uuid, boolean, boolean, timestamptz, text) to authenticated;