-- Batch 3: dual write into public.client_cards. Strictly additive.
-- Nothing reads client_cards yet (app_private.platform_settings card_model_v2 = 'false').

-- Internal helpers. Deliberately NOT aal2-guarded: they are never reachable by a
-- caller (execute revoked from PUBLIC, anon and authenticated) and are only
-- invoked from public wrappers that have already asserted aal2 and membership,
-- or from a trigger on public.clients whose INSERT was itself authorised.
create or replace function app_private.set_client_cards(_client_id uuid, _cards text[])
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.client_cards (client_id, cards)
  values (_client_id, coalesce(array(select distinct x from unnest(_cards) x order by x), '{}'::text[]))
  on conflict (client_id) do update
    set cards = excluded.cards, updated_at = now();
$$;

revoke all on function app_private.set_client_cards(uuid, text[]) from public;
revoke all on function app_private.set_client_cards(uuid, text[]) from anon;
revoke all on function app_private.set_client_cards(uuid, text[]) from authenticated;

create or replace function app_private.set_client_card(_client_id uuid, _card text, _enabled boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare _base text[];
begin
  select cc.cards into _base from public.client_cards cc where cc.client_id = _client_id;
  if _base is null then
    -- No stored list yet: start from everything the purchase allows, so a single
    -- toggle never collapses the dashboard to one card.
    _base := app_private.client_available_cards(_client_id);
  end if;

  if _enabled then
    _base := _base || array[_card];
  else
    _base := array_remove(_base, _card);
  end if;

  perform app_private.set_client_cards(_client_id, _base);
end;
$$;

revoke all on function app_private.set_client_card(uuid, text, boolean) from public;
revoke all on function app_private.set_client_card(uuid, text, boolean) from anon;
revoke all on function app_private.set_client_card(uuid, text, boolean) from authenticated;

-- A client created after cutover gets its card list in the same transaction.
create or replace function app_private.tg_client_cards_default()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform app_private.set_client_cards(new.id, app_private.client_available_cards(new.id));
  return null;
end;
$$;

revoke all on function app_private.tg_client_cards_default() from public;
revoke all on function app_private.tg_client_cards_default() from anon;
revoke all on function app_private.tg_client_cards_default() from authenticated;

drop trigger if exists client_cards_default on public.clients;
create trigger client_cards_default
after insert on public.clients
for each row execute function app_private.tg_client_cards_default();

-- Dual write from the per-client card switch. Body unchanged except the final
-- mirror call; the old tier_widget_config row is still written and still the
-- only thing read.
CREATE OR REPLACE FUNCTION public.set_client_widget_enabled(_client_id uuid, _widget text, _enabled boolean)
 RETURNS TABLE(effective_tier text, is_enabled boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _tier text;
  _firm uuid;
  _excl text[];
  _in_tier boolean;
BEGIN
  perform app_private.assert_aal2();
  -- Membership-only gate: the caller must own the client or be an active
  -- member of the client's organisation. Deliberately NOT
  -- app_private.user_can_manage_client, which admits read-only support grants.
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NO_ACCESS' USING errcode='insufficient_privilege';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clients c
     WHERE c.id = _client_id
       AND (c.owner_user_id = _uid
            OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(_uid, c.firm_id)))
  ) THEN
    RAISE EXCEPTION 'NO_ACCESS' USING errcode='insufficient_privilege';
  END IF;

  SELECT e.tier::text INTO _tier FROM public.client_entitlement(_client_id) e;
  SELECT c.firm_id INTO _firm FROM public.clients c WHERE c.id = _client_id;

  SELECT (_widget = ANY(pl.widgets)) INTO _in_tier
    FROM public.plan_levels pl
   WHERE pl.scope='dashboard' AND pl.key = _tier AND pl.enabled;

  IF _enabled AND NOT coalesce(_in_tier,false) THEN
    RAISE EXCEPTION 'NOT_IN_TIER: % is not part of the % dashboard', _widget, _tier
      USING errcode='check_violation';
  END IF;

  SELECT coalesce(twc.excluded_widgets,'{}') INTO _excl
    FROM public.tier_widget_config twc
   WHERE twc.client_id = _client_id AND twc.tier = _tier;

  IF _enabled THEN
    _excl := array_remove(coalesce(_excl,'{}'), _widget);
  ELSE
    _excl := (SELECT array(SELECT DISTINCT u FROM unnest(coalesce(_excl,'{}') || array[_widget]) u));
  END IF;

  INSERT INTO public.tier_widget_config (client_id, tier, widgets, excluded_widgets)
  VALUES (_client_id, _tier, '{}', _excl)
  ON CONFLICT (client_id, tier) WHERE client_id IS NOT NULL
  DO UPDATE SET excluded_widgets = _excl, updated_at = now();

  -- Batch 3 dual write: mirror the same intent into the new single ticked list.
  PERFORM app_private.set_client_card(_client_id, _widget, _enabled);

  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  VALUES (_uid, _firm, 'client_widget_toggled', 'client', _client_id::text,
          jsonb_build_object('widget',_widget,'enabled',_enabled,'tier',_tier));

  RETURN QUERY SELECT _tier, public.client_can_use_widget(_client_id, _widget);
END;
$function$;

-- Dual write from the bulk per-client save.
CREATE OR REPLACE FUNCTION public.set_client_tier_widgets(_client_id uuid, _tier text, _excluded text[], _clear boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
declare
  _uid uuid := auth.uid();
  _firm_id uuid;
  _existing_id uuid;
begin
  perform app_private.assert_aal2();
  -- Membership-only gate: the caller must own the client or be an active
  -- member of the client's organisation. Deliberately NOT
  -- app_private.user_can_manage_client, which admits read-only support grants.
  if _uid is null then
    raise exception 'NO_ACCESS' using errcode='insufficient_privilege';
  end if;

  select c.firm_id into _firm_id from public.clients c where c.id = _client_id;

  if not exists (
    select 1 from public.clients c
    where c.id = _client_id
      and (
        c.owner_user_id = _uid
        or (c.firm_id is not null and app_private.has_firm_access(_uid, c.firm_id))
      )
  ) then
    raise exception 'NO_ACCESS' using errcode='insufficient_privilege';
  end if;

  if _clear then
    delete from public.tier_widget_config
     where client_id = _client_id
       and tier = _tier;

    -- Cleared means "no exceptions": every available card on.
    perform app_private.set_client_cards(_client_id, app_private.client_available_cards(_client_id));

    insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
    values (_uid, _firm_id, 'client_widget_config_saved', 'tier_widget_config', _client_id::text,
            jsonb_build_object('tier', _tier, 'cleared', true));
    return;
  end if;

  select id into _existing_id
    from public.tier_widget_config
   where tier = _tier and client_id = _client_id;

  if _existing_id is not null then
    update public.tier_widget_config
       set excluded_widgets = _excluded
     where id = _existing_id;
  else
    insert into public.tier_widget_config (client_id, firm_id, tier, excluded_widgets)
    values (_client_id, null, _tier, _excluded);
  end if;

  -- Batch 3 dual write: available cards minus the ones switched off here.
  perform app_private.set_client_cards(
    _client_id,
    coalesce(array(
      select x from unnest(app_private.client_available_cards(_client_id)) as x
      where not (x = any(coalesce(_excluded, '{}'::text[])))
    ), '{}'::text[])
  );

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (_uid, _firm_id, 'client_widget_config_saved', 'tier_widget_config', _client_id::text,
          jsonb_build_object('tier', _tier, 'excluded_widgets', _excluded));
end;
$function$;