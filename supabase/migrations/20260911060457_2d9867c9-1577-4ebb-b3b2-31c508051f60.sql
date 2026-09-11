
-- Phase 4 batch 1: the Xero read gate moves into the database.
-- Every function is caller-scoped (auth.uid()), aal2-guarded, search_path-set,
-- and execute is revoked from PUBLIC/anon.

-- Deterministic tenant -> client. Raises on ambiguity; never guesses.
create or replace function app_private.client_for_tenant(_tenant_id text)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare _n int; _client uuid;
begin
  select count(distinct cxo.client_id) into _n
  from public.client_xero_orgs cxo
  join public.xero_connections xc on xc.id = cxo.xero_connection_id
  where xc.tenant_id = _tenant_id;

  if coalesce(_n,0) = 0 then
    return null;
  elsif _n > 1 then
    raise exception 'This Xero file is linked to more than one client.'
      using errcode = 'raise_exception';
  end if;

  select distinct cxo.client_id into _client
  from public.client_xero_orgs cxo
  join public.xero_connections xc on xc.id = cxo.xero_connection_id
  where xc.tenant_id = _tenant_id;
  return _client;
end;
$$;

create or replace function public.client_for_tenant(_tenant_id text)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare _client uuid;
begin
  perform app_private.assert_aal2();
  _client := app_private.client_for_tenant(_tenant_id);
  if _client is null then return null; end if;
  if not app_private.user_can_read_client(auth.uid(), _client) then return null; end if;
  return _client;
end;
$$;

-- Caller-scoped tenant access (organisation staff, or an approved support grant).
create or replace function public.user_can_access_tenant(_tenant_id text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then return false; end if;
  return app_private.user_can_access_tenant(auth.uid(), _tenant_id);
end;
$$;

-- Merged cards: a stored entitlement for a retired key is the same entitlement
-- as the card it now renders as. Mirrors DEPRECATED_WIDGET_ALIASES.
create or replace function app_private.canonical_widget(_widget text)
returns text
language sql
immutable
set search_path to 'public'
as $$ select case when _widget = 'true_breakeven' then 'accounting_breakeven' else _widget end $$;

-- Ceiling for a tier, with the same fallback the application used when a
-- plan_levels row is missing (today: 'investigate' has no row).
create or replace function app_private.tier_ceiling_widgets(_tier text)
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    nullif((select pl.widgets from public.plan_levels pl
             where pl.scope = 'dashboard' and pl.key = _tier and pl.enabled), '{}'::text[]),
    case _tier
      when 'basic' then array['health','receivables','payables','pnl','notes','unreconciled']
      else array['health','receivables','payables','pnl','notes','unreconciled','superannuation',
                 'accounting_breakeven','true_breakeven','cashflow','cashflow_scenario','xero_audit',
                 'loan_consolidation','gst_reconciliation','transaction_search']
    end)
$$;

-- Deny-list model: ceiling minus (organisation row ELSE platform row) plus the
-- client's own exclusions. Mirrors public.client_allowed_widgets.
create or replace function app_private.effective_widgets_for_client(_client_id uuid, _tier text)
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $$
  with fm as (select firm_id from public.clients where id = _client_id),
  base as (
    select coalesce(
      (select twc.excluded_widgets from public.tier_widget_config twc
        where twc.client_id is null and twc.firm_id = (select firm_id from fm) and twc.tier = _tier),
      (select twc.excluded_widgets from public.tier_widget_config twc
        where twc.client_id is null and twc.firm_id is null and twc.tier = _tier),
      '{}'::text[]) as w
  ),
  excluded as (
    select (select b.w from base b)
        || coalesce((select twc.excluded_widgets from public.tier_widget_config twc
                      where twc.client_id = _client_id and twc.tier = _tier), '{}'::text[]) as w
  )
  select coalesce(array(
    select distinct x from unnest(app_private.tier_ceiling_widgets(_tier)) as x
    except
    select e from unnest((select ex.w from excluded ex)) as e
  ), '{}'::text[])
$$;

-- Who is the caller for this Xero file: organisation staff, or a client viewer
-- at their highest granted level.
create or replace function public.effective_tier_for_tenant(_tenant_id text)
returns table(is_staff boolean, tier text, client_id uuid)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare _uid uuid := auth.uid();
        _client uuid;
        _firm uuid;
        _tier text;
begin
  perform app_private.assert_aal2();
  if _uid is null then
    return query select false, null::text, null::uuid; return;
  end if;

  _client := app_private.client_for_tenant(_tenant_id);
  if _client is not null then
    select c.firm_id into _firm from public.clients c where c.id = _client;
  end if;

  if _firm is not null
     and (app_private.has_firm_access(_uid, _firm)
          or app_private.platform_staff_can_access_firm(_uid, _firm)) then
    return query select true, 'investigate'::text, _client; return;
  end if;

  if _client is not null then
    select ca.tier::text into _tier
    from public.client_access ca
    where ca.user_id = _uid and ca.client_id = _client
    order by case ca.tier::text when 'investigate' then 3 when 'advisory' then 2 else 1 end desc
    limit 1;
  end if;

  return query select false, _tier, _client;
end;
$$;

-- The one gate every Xero dashboard card passes through.
create or replace function public.assert_widget_access(_tenant_id text, _widget text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare _row record;
begin
  perform app_private.assert_aal2();
  select * into _row from public.effective_tier_for_tenant(_tenant_id);

  if not _row.is_staff and _row.tier is null then
    raise exception 'You don''t have access to this organisation.' using errcode = 'raise_exception';
  end if;

  if _row.is_staff then return true; end if;

  if not exists (
    select 1 from unnest(app_private.effective_widgets_for_client(_row.client_id, _row.tier)) as w
    where app_private.canonical_widget(w) = app_private.canonical_widget(_widget)
  ) then
    raise exception 'This widget is not enabled for your dashboard.' using errcode = 'raise_exception';
  end if;
  return true;
end;
$$;

-- A tenant id in a request is a FILTER, never a GRANT: prove the link exists.
create or replace function public.assert_tenant_belongs_to_client(_client_id uuid, _tenant_id text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  if not exists (
    select 1 from public.client_xero_orgs cxo
    join public.xero_connections xc on xc.id = cxo.xero_connection_id
    where cxo.client_id = _client_id and xc.tenant_id = _tenant_id
  ) then
    raise exception 'That Xero organisation does not belong to this client.'
      using errcode = 'raise_exception';
  end if;
  return true;
end;
$$;

-- Cashflow-scenario exclusions: the client's own viewer may edit them, as may
-- organisation staff. A support grant is read-only and never qualifies.
create or replace function public.user_can_write_client_scenario(_client_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare _uid uuid := auth.uid();
begin
  perform app_private.assert_aal2();
  if _uid is null then return false; end if;
  return app_private.user_can_write_client(_uid, _client_id)
      or app_private.has_client_access(_uid, _client_id);
end;
$$;

revoke execute on function app_private.client_for_tenant(text) from public, anon;
revoke execute on function app_private.canonical_widget(text) from public, anon;
revoke execute on function app_private.tier_ceiling_widgets(text) from public, anon;
revoke execute on function app_private.effective_widgets_for_client(uuid, text) from public, anon;

revoke execute on function public.client_for_tenant(text) from public, anon;
revoke execute on function public.user_can_access_tenant(text) from public, anon;
revoke execute on function public.effective_tier_for_tenant(text) from public, anon;
revoke execute on function public.assert_widget_access(text, text) from public, anon;
revoke execute on function public.assert_tenant_belongs_to_client(uuid, text) from public, anon;
revoke execute on function public.user_can_write_client_scenario(uuid) from public, anon;

grant execute on function public.client_for_tenant(text) to authenticated, service_role;
grant execute on function public.user_can_access_tenant(text) to authenticated, service_role;
grant execute on function public.effective_tier_for_tenant(text) to authenticated, service_role;
grant execute on function public.assert_widget_access(text, text) to authenticated, service_role;
grant execute on function public.assert_tenant_belongs_to_client(uuid, text) to authenticated, service_role;
grant execute on function public.user_can_write_client_scenario(uuid) to authenticated, service_role;
grant execute on function app_private.client_for_tenant(text) to service_role;
grant execute on function app_private.canonical_widget(text) to service_role;
grant execute on function app_private.tier_ceiling_widgets(text) to service_role;
grant execute on function app_private.effective_widgets_for_client(uuid, text) to service_role;
