-- Batch 4 of the card-model migration: switch the four card readers over to the
-- purchase + ticked list model. Every branch is gated on
-- app_private.setting_bool('card_model_v2'), which stays 'false' in this
-- migration: with it false behaviour is byte-for-byte as today, with it true
-- nothing consults client_entitlement, client_subscriptions.tier, plan_levels
-- or tier_widget_config for card visibility. The lapsed-organisation check is
-- billing state, not entitlement, and is kept in both models.
--
-- No policy, grant, role or access path is changed here.

-- 1. The v2 resolution with no access check of its own, so callers that have
-- already authorised the read (and organisation-level readers such as
-- firm_allowed_widgets, reachable by a super admin with no membership) can use
-- it without a second, different access rule.
create or replace function app_private.client_cards_v2(_client_id uuid)
returns text[]
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  available text[];
  ticked text[];
begin
  available := app_private.client_available_cards(_client_id);
  select cc.cards into ticked from public.client_cards cc where cc.client_id = _client_id;

  -- No stored list is treated as "all available": a fault shows a staff member
  -- too much rather than a blank dashboard, and never more than the purchase.
  if ticked is null then
    return available;
  end if;

  return coalesce(array(
    select distinct x from unnest(available) as x
    where x = any(ticked)
    order by x
  ), '{}'::text[]);
end;
$$;

revoke all on function app_private.client_cards_v2(uuid) from public;
revoke all on function app_private.client_cards_v2(uuid) from anon;
revoke all on function app_private.client_cards_v2(uuid) from authenticated;

-- 2. The caller-facing reader keeps its own access check and now shares one
-- implementation with the rest of the model.
create or replace function public.client_visible_cards(_client_id uuid)
returns text[]
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();

  if not app_private.user_can_read_client(auth.uid(), _client_id) then
    raise exception 'CLIENT_ACCESS_DENIED';
  end if;

  return app_private.client_cards_v2(_client_id);
end;
$$;

-- 3. The card list. v2: purchase + ticked list only. v1 unchanged below it.
create or replace function public.client_allowed_widgets(_client_id uuid)
returns text[]
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare result text[];
begin
  perform app_private.assert_aal2();

  if auth.uid() is not null
     and not app_private.user_can_read_client(auth.uid(), _client_id) then
    return '{}'::text[];
  end if;

  if app_private.setting_bool('card_model_v2') then
    return app_private.client_cards_v2(_client_id);
  end if;

  with ent as (select tier::text as tier from public.client_entitlement(_client_id)),
  fm as (select firm_id from public.clients where id = _client_id),
  ceiling as (
    select coalesce(pl.widgets,'{}'::text[]) as w
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
  ),'{}'::text[]) into result;

  return result;
end;
$$;

-- 4. THE dashboard read gate. v2: one list for everyone who can read the
-- client — organisation staff and external advisers alike. The adviser's own
-- client_access.tier no longer narrows cards (owner decision, 15 Sep 2026: an
-- adviser sees what the client sees, capped by the purchase, read-only), and
-- staff can no longer reach a card the organisation has not purchased or the
-- client has not ticked, by dashboard read, direct URL, server function or
-- report link. Read-only status is unaffected: it is enforced by the write
-- policies and write helpers, not here.
create or replace function public.assert_widget_access(_tenant_id text, _widget text)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare _row record;
begin
  perform app_private.assert_aal2();
  select * into _row from public.effective_tier_for_tenant(_tenant_id);

  if not _row.is_staff and _row.tier is null then
    raise exception 'You don''t have access to this organisation.' using errcode = 'raise_exception';
  end if;

  if app_private.setting_bool('card_model_v2') then
    if _row.client_id is null then
      raise exception 'You don''t have access to this organisation.' using errcode = 'raise_exception';
    end if;
    if not exists (
      select 1 from unnest(app_private.client_cards_v2(_row.client_id)) as w
      where app_private.canonical_widget(w) = app_private.canonical_widget(_widget)
    ) then
      raise exception 'This widget is not enabled for your dashboard.' using errcode = 'raise_exception';
    end if;
    return true;
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

-- 5. One answer for Consolidation. v2 reads the purchase row; v1 reads the old
-- subscriptions column. The lapsed check stays in both.
create or replace function public.firm_has_consolidation(_firm_id uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();

  if auth.uid() is not null
     and not public.user_can_access_firm(auth.uid(), _firm_id)
     and not app_private.is_super_admin(auth.uid()) then
    return false;
  end if;

  if app_private.firm_subscription_lapsed(_firm_id) then
    return false;
  end if;

  if app_private.setting_bool('card_model_v2') then
    return exists (
      select 1 from public.org_subscription_options o
      where o.firm_id = _firm_id and o.consolidation_enabled
    );
  end if;

  return exists (
    select 1 from public.subscriptions s
    where s.firm_id = _firm_id and s.consolidation_enabled
  );
end;
$$;

-- 6. Organisation-level features. v2 unions the clients' own visible lists and
-- adds the organisation add-on cards only when Consolidation is purchased.
create or replace function public.firm_allowed_widgets(_firm_id uuid)
returns text[]
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare result text[];
begin
  perform app_private.assert_aal2();

  if auth.uid() is not null
     and not public.user_can_access_firm(auth.uid(), _firm_id)
     and not app_private.is_super_admin(auth.uid()) then
    return '{}'::text[];
  end if;

  if app_private.setting_bool('card_model_v2') then
    select coalesce(array(
      select w from unnest(public.org_addon_widgets()) as w
       where public.firm_has_consolidation(_firm_id)
      union
      select distinct w2
        from public.clients c
        cross join lateral unnest(app_private.client_cards_v2(c.id)) as w2
       where c.firm_id = _firm_id
         and not (w2 = any(public.org_addon_widgets()))
    ), '{}'::text[]) into result;
    return result;
  end if;

  select coalesce(array(
    select w from unnest(public.org_addon_widgets()) as w
     where public.firm_has_consolidation(_firm_id)
    union
    select distinct w2
      from public.clients c
      cross join lateral unnest(public.client_allowed_widgets(c.id)) as w2
     where c.firm_id = _firm_id
       and not (w2 = any(public.org_addon_widgets()))
  ), '{}'::text[]) into result;

  return result;
end;
$$;

revoke all on function public.client_visible_cards(uuid) from public;
revoke all on function public.client_visible_cards(uuid) from anon;
revoke all on function public.client_allowed_widgets(uuid) from public;
revoke all on function public.client_allowed_widgets(uuid) from anon;
revoke all on function public.assert_widget_access(text, text) from public;
revoke all on function public.assert_widget_access(text, text) from anon;
revoke all on function public.firm_has_consolidation(uuid) from public;
revoke all on function public.firm_has_consolidation(uuid) from anon;
revoke all on function public.firm_allowed_widgets(uuid) from public;
revoke all on function public.firm_allowed_widgets(uuid) from anon;