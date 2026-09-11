-- Backlog 28: no direct browser writes to client_subscriptions.
drop policy if exists "super admins manage client subscriptions" on public.client_subscriptions;
drop policy if exists "staff manage client subscriptions" on public.client_subscriptions;
revoke insert, update, delete, truncate on public.client_subscriptions from authenticated;
revoke all on public.client_subscriptions from anon;
grant select on public.client_subscriptions to authenticated;
grant all on public.client_subscriptions to service_role;

-- Comp a client onto free Standard, or remove the comp. Super admin, reason, audited.
create or replace function public.set_client_comp(_client_id uuid, _comped boolean, _reason text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  _before public.client_subscriptions%rowtype;
  _uid uuid := auth.uid();
  _firm uuid;
begin
  perform app_private.assert_aal2();
  if _uid is null or not app_private.me_is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  if _reason is null or length(btrim(_reason)) < 3 then
    raise exception 'A reason is required.' using errcode = 'check_violation';
  end if;

  select firm_id into _firm from public.clients where id = _client_id;
  if not found then
    raise exception 'Client not found.' using errcode = 'no_data_found';
  end if;
  select * into _before from public.client_subscriptions where client_id = _client_id;

  insert into public.client_subscriptions as cs (
    client_id, subscription_type, status, dashboard_tier, plan_name,
    trial_end, comp_reason, comped_by, comped_at)
  values (
    _client_id,
    case when _comped then 'free_forever' else 'paid' end::public.client_subscription_type,
    case when _comped then 'free_forever' else 'cancelled' end::public.client_subscription_status,
    case when _comped then 'basic' else coalesce(_before.dashboard_tier, 'basic') end::public.dashboard_tier,
    case when _comped then 'Standard (comped)' else _before.plan_name end,
    case when _comped then null else _before.trial_end end,
    btrim(_reason), _uid,
    case when _comped then now() else null end)
  on conflict (client_id) do update set
    subscription_type = excluded.subscription_type,
    status = excluded.status,
    dashboard_tier = excluded.dashboard_tier,
    plan_name = excluded.plan_name,
    trial_end = excluded.trial_end,
    comp_reason = excluded.comp_reason,
    comped_by = excluded.comped_by,
    comped_at = excluded.comped_at,
    updated_at = now();

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (_uid, _firm,
    case when _comped then 'client_comp_granted' else 'client_comp_removed' end,
    'client', _client_id::text,
    jsonb_build_object('reason', btrim(_reason),
      'previous', case when _before.id is null then null else jsonb_build_object(
        'type', _before.subscription_type, 'status', _before.status,
        'tier', _before.dashboard_tier) end));
  return _comped;
end;
$$;
revoke execute on function public.set_client_comp(uuid, boolean, text) from public, anon;
grant execute on function public.set_client_comp(uuid, boolean, text) to authenticated, service_role;

-- Start or end a trial of a higher dashboard. Super admin, reason, audited.
create or replace function public.set_client_trial(_client_id uuid, _tier text, _days integer, _reason text)
returns timestamptz
language plpgsql
security definer
set search_path to ''
as $$
declare
  _before public.client_subscriptions%rowtype;
  _uid uuid := auth.uid();
  _firm uuid;
  _trial_end timestamptz;
  _d integer := least(greatest(coalesce(_days, 30), 1), 120);
begin
  perform app_private.assert_aal2();
  if _uid is null or not app_private.me_is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  if _reason is null or length(btrim(_reason)) < 3 then
    raise exception 'A reason is required.' using errcode = 'check_violation';
  end if;

  select firm_id into _firm from public.clients where id = _client_id;
  if not found then
    raise exception 'Client not found.' using errcode = 'no_data_found';
  end if;
  select * into _before from public.client_subscriptions where client_id = _client_id;

  _trial_end := case when _tier is null then null else now() + make_interval(days => _d) end;

  insert into public.client_subscriptions as cs (
    client_id, subscription_type, status, dashboard_tier, trial_end, plan_name)
  values (
    _client_id,
    case when _tier is null then 'paid' else 'trial' end::public.client_subscription_type,
    case when _tier is null then 'cancelled' else 'trialing' end::public.client_subscription_status,
    coalesce(_tier, 'basic')::public.dashboard_tier,
    _trial_end,
    _before.plan_name)
  on conflict (client_id) do update set
    subscription_type = excluded.subscription_type,
    status = excluded.status,
    dashboard_tier = excluded.dashboard_tier,
    trial_end = excluded.trial_end,
    plan_name = excluded.plan_name,
    updated_at = now();

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (_uid, _firm,
    case when _tier is null then 'client_trial_ended' else 'client_trial_started' end,
    'client', _client_id::text,
    jsonb_build_object('reason', btrim(_reason), 'tier', _tier, 'trial_end', _trial_end,
      'previous', case when _before.id is null then null else jsonb_build_object(
        'type', _before.subscription_type, 'status', _before.status,
        'tier', _before.dashboard_tier, 'trial_end', _before.trial_end) end));
  return _trial_end;
end;
$$;
revoke execute on function public.set_client_trial(uuid, text, integer, text) from public, anon;
grant execute on function public.set_client_trial(uuid, text, integer, text) to authenticated, service_role;

-- Set one client's dashboard level. Organisation member (write access) or super admin.
create or replace function public.set_client_dashboard_tier(_client_id uuid, _tier text, _reason text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  _before public.client_subscriptions%rowtype;
  _uid uuid := auth.uid();
  _firm uuid;
begin
  perform app_private.assert_aal2();
  if _uid is null then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  if not (app_private.user_can_write_client(_uid, _client_id) or app_private.me_is_super_admin()) then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  if _tier is null then
    raise exception 'Unknown dashboard level.' using errcode = 'check_violation';
  end if;

  select firm_id into _firm from public.clients where id = _client_id;
  if not found then
    raise exception 'Client not found.' using errcode = 'no_data_found';
  end if;
  select * into _before from public.client_subscriptions where client_id = _client_id;

  if _before.id is null and _tier = 'basic' then
    -- No row already resolves to Standard; do not create one just to store it.
    return 'basic';
  end if;

  if _before.id is null then
    insert into public.client_subscriptions (
      client_id, dashboard_tier, subscription_type, status, comp_reason, comped_by, comped_at)
    values (_client_id, _tier::public.dashboard_tier, 'free_forever', 'active',
      coalesce(nullif(btrim(coalesce(_reason, '')), ''), 'Dashboard tier assigned by the organisation'),
      _uid, now());
  else
    update public.client_subscriptions
       set dashboard_tier = _tier::public.dashboard_tier, updated_at = now()
     where client_id = _client_id;
  end if;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (_uid, _firm, 'client_dashboard_tier_changed', 'client', _client_id::text,
    jsonb_build_object('reason', nullif(btrim(coalesce(_reason, '')), ''),
      'from', _before.dashboard_tier, 'to', _tier));
  return _tier;
end;
$$;
revoke execute on function public.set_client_dashboard_tier(uuid, text, text) from public, anon;
grant execute on function public.set_client_dashboard_tier(uuid, text, text) to authenticated, service_role;