-- Admin write + read paths for the purchase + ticked-list card model (v2).
-- Additive only: no table, column, policy or grant is altered.

-- 1. Card groupings, read-only, so the UI never mirrors the rule in TypeScript.
create or replace function public.card_group_list()
returns table(card_group text, cards text[])
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  return query
    select g, app_private.card_group_cards(g)
    from unnest(array['standard','advisory','consolidation']) as g;
end;
$$;
revoke execute on function public.card_group_list() from public, anon;
grant execute on function public.card_group_list() to authenticated;

-- 2. One organisation's purchase options.
create or replace function public.org_purchase(_firm_id uuid)
returns table(
  firm_id uuid,
  client_limit integer,
  advisory_enabled boolean,
  consolidation_enabled boolean,
  billing_mode text,
  client_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;
  -- Organisation members, platform staff with a path, or a super admin reading
  -- plan metadata (Path C). No client or Xero data is exposed here.
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
           (select count(*)::int from public.clients c where c.firm_id = f.id)
      from public.firms f
      left join public.org_subscription_options o on o.firm_id = f.id
     where f.id = _firm_id;
end;
$$;
revoke execute on function public.org_purchase(uuid) from public, anon;
grant execute on function public.org_purchase(uuid) to authenticated;

-- 3. Set an organisation's purchase. Super admin only, audited.
create or replace function public.set_org_purchase(
  _firm_id uuid,
  _client_limit integer,
  _advisory boolean,
  _consolidation boolean,
  _billing_mode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _prev_advisory boolean := false;
  _prev_consolidation boolean := false;
  _existed boolean := false;
  _siblings int;
begin
  perform public.assert_super_admin();  -- re-checks aal2 first

  if _billing_mode is null or _billing_mode not in ('bookkeeping','external') then
    raise exception 'INVALID_BILLING_MODE' using errcode = 'check_violation';
  end if;
  if _client_limit is null or _client_limit < 0 or _client_limit > 9999 then
    raise exception 'INVALID_CLIENT_LIMIT' using errcode = 'check_violation';
  end if;
  if coalesce(_consolidation, false) and not coalesce(_advisory, false) then
    raise exception 'CONSOLIDATION_REQUIRES_ADVISORY' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.firms f where f.id = _firm_id) then
    raise exception 'NO_SUCH_ORGANISATION' using errcode = 'no_data_found';
  end if;

  select true, o.advisory_enabled, o.consolidation_enabled
    into _existed, _prev_advisory, _prev_consolidation
    from public.org_subscription_options o
   where o.firm_id = _firm_id;

  insert into public.org_subscription_options
    (firm_id, client_limit, advisory_enabled, consolidation_enabled, billing_mode)
  values (_firm_id, _client_limit, coalesce(_advisory,false), coalesce(_consolidation,false), _billing_mode)
  on conflict (firm_id) do update
    set client_limit = excluded.client_limit,
        advisory_enabled = excluded.advisory_enabled,
        consolidation_enabled = excluded.consolidation_enabled,
        billing_mode = excluded.billing_mode,
        updated_at = now();

  -- Switching an option ON ticks its cards for every client in the organisation,
  -- per the approved design. Switching it OFF writes nothing: the per-client
  -- ticks stay exactly as they are so the arrangement returns intact.
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

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm_id, 'org_purchase_set', 'firm', _firm_id::text,
          jsonb_build_object(
            'existed', coalesce(_existed,false),
            'client_limit', _client_limit,
            'advisory', coalesce(_advisory,false),
            'consolidation', coalesce(_consolidation,false),
            'billing_mode', _billing_mode,
            'previous_advisory', coalesce(_prev_advisory,false),
            'previous_consolidation', coalesce(_prev_consolidation,false)));
end;
$$;
revoke execute on function public.set_org_purchase(uuid, integer, boolean, boolean, text) from public, anon;
grant execute on function public.set_org_purchase(uuid, integer, boolean, boolean, text) to authenticated;

-- 4. Tick / untick one card for one client. Write access to the client, audited.
create or replace function public.set_client_card_enabled(
  _client_id uuid,
  _card text,
  _enabled boolean
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  _base text[];
  _firm uuid;
begin
  perform public.assert_client_write_access(_client_id);  -- aal2 + membership

  if _card is null or _card = '' then
    raise exception 'INVALID_CARD' using errcode = 'check_violation';
  end if;

  if coalesce(_enabled,false)
     and not (_card = any(app_private.client_available_cards(_client_id))) then
    raise exception 'CARD_NOT_AVAILABLE' using errcode = 'check_violation';
  end if;

  select cc.cards into _base from public.client_cards cc where cc.client_id = _client_id;
  if _base is null then
    _base := app_private.client_available_cards(_client_id);
  end if;

  if coalesce(_enabled,false) then
    _base := _base || array[_card];
  else
    _base := array_remove(_base, _card);
  end if;

  perform app_private.set_client_cards(_client_id, _base);

  select c.firm_id into _firm from public.clients c where c.id = _client_id;
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm, 'client_card_toggled', 'client', _client_id::text,
          jsonb_build_object('card', _card, 'enabled', coalesce(_enabled,false)));

  return app_private.client_cards_v2(_client_id);
end;
$$;
revoke execute on function public.set_client_card_enabled(uuid, text, boolean) from public, anon;
grant execute on function public.set_client_card_enabled(uuid, text, boolean) to authenticated;

-- 5. Copy one client's card setup to other clients in the SAME organisation.
create or replace function public.copy_client_cards(
  _from_client_id uuid,
  _to_client_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _firm uuid;
  _cards text[];
  _target uuid;
  _target_firm uuid;
  _n int := 0;
begin
  perform public.assert_client_write_access(_from_client_id);

  select c.firm_id into _firm from public.clients c where c.id = _from_client_id;
  if _firm is null then
    raise exception 'SOURCE_HAS_NO_ORGANISATION' using errcode = 'check_violation';
  end if;

  select cc.cards into _cards from public.client_cards cc where cc.client_id = _from_client_id;
  if _cards is null then
    _cards := app_private.client_available_cards(_from_client_id);
  end if;

  foreach _target in array coalesce(_to_client_ids, '{}'::uuid[]) loop
    if _target = _from_client_id then
      continue;
    end if;
    select c.firm_id into _target_firm from public.clients c where c.id = _target;
    if _target_firm is distinct from _firm then
      raise exception 'DIFFERENT_ORGANISATION' using errcode = 'insufficient_privilege';
    end if;
    perform public.assert_client_write_access(_target);
    perform app_private.set_client_cards(_target, _cards);
    insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
    values (auth.uid(), _firm, 'client_cards_copied', 'client', _target::text,
            jsonb_build_object('from_client_id', _from_client_id, 'cards', to_jsonb(_cards)));
    _n := _n + 1;
  end loop;

  return _n;
end;
$$;
revoke execute on function public.copy_client_cards(uuid, uuid[]) from public, anon;
grant execute on function public.copy_client_cards(uuid, uuid[]) to authenticated;