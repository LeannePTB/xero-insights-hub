-- Branding becomes a fourth purchasable organisation option.
-- Additive: new columns default off, no existing row changes meaning, and no
-- access path is added. Branding is an entitlement, never a grant.

alter table public.org_subscription_options
  add column if not exists branding_enabled boolean not null default false,
  add column if not exists trial_branding_enabled boolean not null default false;

-- ---------------------------------------------------------------- effective options
drop function if exists app_private.org_effective_options(uuid);

create function app_private.org_effective_options(_firm_id uuid)
returns table(
  advisory boolean,
  consolidation boolean,
  branding boolean,
  purchased_advisory boolean,
  purchased_consolidation boolean,
  purchased_branding boolean,
  trial_advisory boolean,
  trial_consolidation boolean,
  trial_branding boolean,
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
           coalesce(opt.branding_enabled, false) as p_brand,
           coalesce(opt.trial_advisory_enabled, false) as t_adv,
           coalesce(opt.trial_consolidation_enabled, false) as t_con,
           coalesce(opt.trial_branding_enabled, false) as t_brand,
           opt.trial_ends_at as t_end
      from public.org_subscription_options opt
     where opt.firm_id = _firm_id
  ),
  r as (
    select coalesce((select p_adv from o), false) as p_adv,
           coalesce((select p_con from o), false) as p_con,
           coalesce((select p_brand from o), false) as p_brand,
           coalesce((select t_adv from o), false) as t_adv,
           coalesce((select t_con from o), false) as t_con,
           coalesce((select t_brand from o), false) as t_brand,
           (select t_end from o) as t_end
  ),
  live as (
    select r.*, (r.t_end is not null and r.t_end > now()) as t_live from r
  )
  select
    (live.p_adv or (live.t_live and live.t_adv)) as advisory,
    (live.p_con or (live.t_live and live.t_con))
      and (live.p_adv or (live.t_live and live.t_adv)) as consolidation,
    (live.p_brand or (live.t_live and live.t_brand))
      and (live.p_adv or (live.t_live and live.t_adv)) as branding,
    live.p_adv, live.p_con, live.p_brand,
    live.t_adv, live.t_con, live.t_brand,
    live.t_end, live.t_live
  from live
$function$;

revoke all on function app_private.org_effective_options(uuid) from public;
revoke all on function app_private.org_effective_options(uuid) from anon;
grant execute on function app_private.org_effective_options(uuid) to service_role;

-- Effective branding, capped by the lapsed check exactly as cards are.
create or replace function app_private.firm_branding_enabled(_firm_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select e.branding from app_private.org_effective_options(_firm_id) e),
    false
  ) and not app_private.firm_subscription_lapsed(_firm_id)
$function$;

revoke all on function app_private.firm_branding_enabled(uuid) from public;
revoke all on function app_private.firm_branding_enabled(uuid) from anon;
grant execute on function app_private.firm_branding_enabled(uuid) to service_role;

-- Caller-scoped question: may this client's branding be set or rendered?
-- Entitlement only. It never widens who can see or write the client; the read
-- check comes first and is the same one every client path uses.
create or replace function public.client_branding_enabled(_client_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare _firm uuid;
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;
  if not app_private.user_can_read_client(auth.uid(), _client_id) then
    raise exception 'CLIENT_ACCESS_DENIED' using errcode = 'insufficient_privilege';
  end if;
  select c.firm_id into _firm from public.clients c where c.id = _client_id;
  if _firm is null then
    return false;
  end if;
  return app_private.firm_branding_enabled(_firm);
end;
$function$;

revoke all on function public.client_branding_enabled(uuid) from public;
revoke all on function public.client_branding_enabled(uuid) from anon;
grant execute on function public.client_branding_enabled(uuid) to authenticated;
grant execute on function public.client_branding_enabled(uuid) to service_role;

-- ---------------------------------------------------------------- read the purchase
drop function if exists public.org_purchase(uuid);

create function public.org_purchase(_firm_id uuid)
returns table(
  firm_id uuid,
  client_limit integer,
  advisory_enabled boolean,
  consolidation_enabled boolean,
  branding_enabled boolean,
  billing_mode text,
  client_count integer,
  trial_advisory_enabled boolean,
  trial_consolidation_enabled boolean,
  trial_branding_enabled boolean,
  trial_ends_at timestamptz,
  trial_active boolean,
  effective_advisory boolean,
  effective_consolidation boolean,
  effective_branding boolean
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
           coalesce(o.branding_enabled, false),
           coalesce(o.billing_mode, 'bookkeeping'),
           (select count(*)::int from public.clients c where c.firm_id = f.id),
           coalesce(o.trial_advisory_enabled, false),
           coalesce(o.trial_consolidation_enabled, false),
           coalesce(o.trial_branding_enabled, false),
           o.trial_ends_at,
           e.trial_active,
           e.advisory,
           e.consolidation,
           e.branding
      from public.firms f
      left join public.org_subscription_options o on o.firm_id = f.id
      cross join lateral app_private.org_effective_options(f.id) e
     where f.id = _firm_id;
end;
$function$;

revoke all on function public.org_purchase(uuid) from public;
revoke all on function public.org_purchase(uuid) from anon;
grant execute on function public.org_purchase(uuid) to authenticated;
grant execute on function public.org_purchase(uuid) to service_role;

-- ---------------------------------------------------------------- write the purchase
drop function if exists public.set_org_purchase(uuid, integer, boolean, boolean, text);

create function public.set_org_purchase(
  _firm_id uuid,
  _client_limit integer,
  _advisory boolean,
  _consolidation boolean,
  _branding boolean,
  _billing_mode text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _prev_advisory boolean := false;
  _prev_consolidation boolean := false;
  _prev_branding boolean := false;
  _existed boolean := false;
  _siblings int;
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();

  if _billing_mode is null or _billing_mode not in ('bookkeeping','external') then
    raise exception 'INVALID_BILLING_MODE' using errcode = 'check_violation';
  end if;
  if _client_limit is null or _client_limit < 0 or _client_limit > 9999 then
    raise exception 'INVALID_CLIENT_LIMIT' using errcode = 'check_violation';
  end if;
  if coalesce(_consolidation, false) and not coalesce(_advisory, false) then
    raise exception 'CONSOLIDATION_REQUIRES_ADVISORY' using errcode = 'check_violation';
  end if;
  if coalesce(_branding, false) and not coalesce(_advisory, false) then
    raise exception 'BRANDING_REQUIRES_ADVISORY' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.firms f where f.id = _firm_id) then
    raise exception 'NO_SUCH_ORGANISATION' using errcode = 'no_data_found';
  end if;

  select true, o.advisory_enabled, o.consolidation_enabled, o.branding_enabled
    into _existed, _prev_advisory, _prev_consolidation, _prev_branding
    from public.org_subscription_options o
   where o.firm_id = _firm_id;

  insert into public.org_subscription_options
    (firm_id, client_limit, advisory_enabled, consolidation_enabled, branding_enabled, billing_mode)
  values (_firm_id, _client_limit, coalesce(_advisory,false), coalesce(_consolidation,false),
          coalesce(_branding,false), _billing_mode)
  on conflict (firm_id) do update
    set client_limit = excluded.client_limit,
        advisory_enabled = excluded.advisory_enabled,
        consolidation_enabled = excluded.consolidation_enabled,
        branding_enabled = excluded.branding_enabled,
        billing_mode = excluded.billing_mode,
        updated_at = now();

  if coalesce(_advisory,false) and not coalesce(_prev_advisory,false) then
    update public.client_cards cc
       set cards = array(select distinct x
                           from unnest(cc.cards || app_private.card_group_cards('advisory')) x
                          order by x),
           updated_at = now()
     where cc.client_id in (select c.id from public.clients c where c.firm_id = _firm_id);
  end if;

  select count(*) into _siblings from public.clients c where c.firm_id = _firm_id;
  if coalesce(_consolidation,false) and not coalesce(_prev_consolidation,false) and _siblings > 1 then
    update public.client_cards cc
       set cards = array(select distinct x
                           from unnest(cc.cards || app_private.card_group_cards('consolidation')) x
                          order by x),
           updated_at = now()
     where cc.client_id in (select c.id from public.clients c where c.firm_id = _firm_id);
  end if;

  -- Branding is not a card: switching it off changes no client_cards row and
  -- deletes no logo. Stored logos simply stop being served.

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm_id, 'org_purchase_set', 'firm', _firm_id::text,
          jsonb_build_object(
            'existed', coalesce(_existed,false),
            'client_limit', _client_limit,
            'advisory', coalesce(_advisory,false),
            'consolidation', coalesce(_consolidation,false),
            'branding', coalesce(_branding,false),
            'billing_mode', _billing_mode,
            'previous_advisory', coalesce(_prev_advisory,false),
            'previous_consolidation', coalesce(_prev_consolidation,false),
            'previous_branding', coalesce(_prev_branding,false)));
end;
$function$;

revoke all on function public.set_org_purchase(uuid, integer, boolean, boolean, boolean, text) from public;
revoke all on function public.set_org_purchase(uuid, integer, boolean, boolean, boolean, text) from anon;
grant execute on function public.set_org_purchase(uuid, integer, boolean, boolean, boolean, text) to authenticated;
grant execute on function public.set_org_purchase(uuid, integer, boolean, boolean, boolean, text) to service_role;

-- ---------------------------------------------------------------- trials
drop function if exists public.set_org_trial(uuid, boolean, boolean, timestamptz, text);

create function public.set_org_trial(
  _firm_id uuid,
  _advisory boolean,
  _consolidation boolean,
  _branding boolean,
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
  _brand boolean := coalesce(_branding, false);
  _end timestamptz := _ends_at;
  _touched integer;
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
  if not _adv and not _con and not _brand then
    _adv := false; _con := false; _brand := false; _end := null;
  else
    if _con and not _adv then
      raise exception 'CONSOLIDATION_REQUIRES_ADVISORY' using errcode = 'check_violation';
    end if;
    if _brand and not _adv then
      raise exception 'BRANDING_REQUIRES_ADVISORY' using errcode = 'check_violation';
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
         coalesce(o.trial_branding_enabled, false) as t_brand,
         o.trial_ends_at as t_end
    into _prev
    from public.org_subscription_options o
   where o.firm_id = _firm_id;

  -- Trial fields only: purchased options are never touched here.
  update public.org_subscription_options o
     set trial_advisory_enabled = _adv,
         trial_consolidation_enabled = _con,
         trial_branding_enabled = _brand,
         trial_ends_at = _end,
         updated_at = now()
   where o.firm_id = _firm_id;
  get diagnostics _touched = row_count;

  if _touched = 0 then
    insert into public.org_subscription_options
      (firm_id, trial_advisory_enabled, trial_consolidation_enabled, trial_branding_enabled, trial_ends_at)
    values (_firm_id, _adv, _con, _brand, _end);
  end if;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (
    auth.uid(), _firm_id, 'org_trial_set', 'firm', _firm_id::text,
    jsonb_build_object(
      'reason', btrim(_reason),
      'previous', jsonb_build_object(
        'advisory', coalesce(_prev.t_adv, false),
        'consolidation', coalesce(_prev.t_con, false),
        'branding', coalesce(_prev.t_brand, false),
        'ends_at', _prev.t_end
      ),
      'new', jsonb_build_object(
        'advisory', _adv,
        'consolidation', _con,
        'branding', _brand,
        'ends_at', _end
      )
    )
  );

  return _end;
end;
$function$;

revoke all on function public.set_org_trial(uuid, boolean, boolean, boolean, timestamptz, text) from public;
revoke all on function public.set_org_trial(uuid, boolean, boolean, boolean, timestamptz, text) from anon;
grant execute on function public.set_org_trial(uuid, boolean, boolean, boolean, timestamptz, text) to authenticated;
grant execute on function public.set_org_trial(uuid, boolean, boolean, boolean, timestamptz, text) to service_role;