-- Card catalogue moves from a hardcoded CASE into data. Seeded with the exact
-- lists app_private.card_group_cards returned, so no client's cards change.
create table public.card_modules (
  module_key text primary key check (module_key ~ '^[a-z][a-z_]{1,39}$'),
  label text not null check (char_length(label) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.card_catalogue (
  card_key text primary key check (card_key ~ '^[a-z][a-z_]{1,39}$'),
  package text not null check (package in ('standard','advisory','consolidation')),
  module_key text references public.card_modules(module_key),
  label text not null check (char_length(label) between 1 and 80),
  description text not null default '' check (char_length(description) <= 300),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint card_catalogue_module_matches_package check ((package = 'advisory') = (module_key is not null))
);

revoke all on table public.card_modules from public, anon, authenticated;
revoke all on table public.card_catalogue from public, anon, authenticated;
grant select (module_key, label, description, sort_order) on table public.card_modules to authenticated;
grant select (card_key, package, module_key, label, description, sort_order) on table public.card_catalogue to authenticated;
grant all on table public.card_modules to service_role;
grant all on table public.card_catalogue to service_role;

alter table public.card_modules enable row level security;
alter table public.card_catalogue enable row level security;

create policy mfa_aal2_required on public.card_modules as restrictive for all to authenticated using (app_private.is_aal2()) with check (app_private.is_aal2());
create policy mfa_aal2_required on public.card_catalogue as restrictive for all to authenticated using (app_private.is_aal2()) with check (app_private.is_aal2());
-- Product catalogue copy only (no organisation, client, Xero or personal data).
create policy "card modules readable by signed-in users" on public.card_modules as permissive for select to authenticated using (auth.uid() is not null);
create policy "card catalogue readable by signed-in users" on public.card_catalogue as permissive for select to authenticated using (auth.uid() is not null);

insert into public.card_modules (module_key, label, description, sort_order) values
  ('cash_flow', 'Cash flow', 'See where cash is heading over the next 90 days and test what-if changes.', 10),
  ('profit', 'Profit', 'Know the revenue the business needs to cover its costs.', 20),
  ('tax_compliance', 'Tax & compliance', 'Tax, GST, super and PAYG owed, and when each is due.', 30),
  ('bookkeeping_checks', 'Bookkeeping checks', 'Find problems in the Xero file and search its transactions.', 40);

insert into public.card_catalogue (card_key, package, module_key, label, description, sort_order) values
  ('health', 'standard', null, 'Business health', 'A plain-English health check of the business, with what needs attention first.', 10),
  ('receivables', 'standard', null, 'Aged receivables', 'Who owes the business money and how overdue each invoice is.', 20),
  ('payables', 'standard', null, 'Aged payables', 'Bills the business owes and which are overdue.', 30),
  ('pnl', 'standard', null, 'Profit & loss', 'Income, expenses and profit for the period, compared with earlier periods.', 40),
  ('notes', 'standard', null, 'Notes', 'Notes from the adviser that sit alongside the monthly report.', 50),
  ('cashflow', 'advisory', 'cash_flow', 'Cash flow', 'Money in and out by month, and where cash is heading over the next 90 days.', 110),
  ('cashflow_scenario', 'advisory', 'cash_flow', 'Cash flow scenario', 'Try what-if changes to income and costs and see the effect on cash.', 120),
  ('accounting_breakeven', 'advisory', 'profit', 'Break-even', 'The revenue needed to cover costs, and how far above or below it the business is.', 130),
  ('tax_obligations', 'advisory', 'tax_compliance', 'Tax obligations', 'Tax owed and when it is due, including the rental property report.', 140),
  ('gst_reconciliation', 'advisory', 'tax_compliance', 'Activity statement — GST (indicative)', 'An indicative GST figure for the current activity statement period.', 150),
  ('superannuation', 'advisory', 'tax_compliance', 'Superannuation', 'Super owed to employees'' funds and when it is due.', 160),
  ('payg_withholding', 'advisory', 'tax_compliance', 'PAYG withholding by month', 'PAYG withheld from wages each month and what is still owing.', 170),
  ('xero_audit', 'advisory', 'bookkeeping_checks', 'Xero file audit', 'Checks the Xero file for bookkeeping problems that could make the numbers wrong.', 180),
  ('transaction_search', 'advisory', 'bookkeeping_checks', 'Transaction search', 'Search the Xero file''s transactions by amount, contact or description.', 190),
  ('loan_consolidation', 'consolidation', null, 'Loan consolidation', 'Loans between companies in a group, matched so balances agree across files.', 210);

-- The same functions, now reading the catalogue table (one implementation).
create or replace function app_private.card_group_cards(_group text)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array(
    select c.card_key from public.card_catalogue c
     where c.package = _group order by c.sort_order, c.card_key
  ), '{}'::text[])
$$;

create or replace function app_private.known_cards()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array(select c.card_key from public.card_catalogue c order by c.sort_order, c.card_key), '{}'::text[])
$$;

-- One gate for every card/module write: Organisation Owner of that organisation,
-- or System Administrator, at aal2. Staff, Viewers, Business Owners and support
-- grants are refused.
create or replace function app_private.assert_card_manager(_firm_id uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;
  if app_private.me_is_super_admin() then return; end if;
  if _firm_id is not null and app_private.is_org_owner(auth.uid(), _firm_id) then return; end if;
  raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
end;
$$;
revoke execute on function app_private.assert_card_manager(uuid) from public, anon;

-- Presentation signal only; every write re-checks through assert_card_manager.
create or replace function public.me_can_manage_cards(_firm_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then return false; end if;
  return app_private.me_is_super_admin()
      or (_firm_id is not null and app_private.is_org_owner(auth.uid(), _firm_id));
end;
$$;
revoke execute on function public.me_can_manage_cards(uuid) from public, anon;
grant execute on function public.me_can_manage_cards(uuid) to authenticated;

-- Catalogue writes: System Administrator at aal2, audited.
create or replace function public.admin_set_card_entry(_card_key text, _package text, _module_key text, _description text)
returns void language plpgsql security definer set search_path = public as $$
declare _old record; _desc text := btrim(coalesce(_description, ''));
begin
  perform public.assert_super_admin();
  select * into _old from public.card_catalogue where card_key = _card_key;
  if not found then raise exception 'NO_SUCH_CARD' using errcode = 'no_data_found'; end if;
  if _package not in ('standard','advisory','consolidation') then
    raise exception 'INVALID_PACKAGE' using errcode = 'check_violation';
  end if;
  if _package = 'advisory' then
    if _module_key is null or not exists (select 1 from public.card_modules m where m.module_key = _module_key) then
      raise exception 'MODULE_REQUIRED' using errcode = 'check_violation';
    end if;
  else
    _module_key := null;
  end if;
  if char_length(_desc) > 300 then raise exception 'DESCRIPTION_TOO_LONG' using errcode = 'check_violation'; end if;

  update public.card_catalogue
     set package = _package, module_key = _module_key, description = _desc,
         updated_at = now(), updated_by = auth.uid()
   where card_key = _card_key;

  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'card_catalogue_changed', 'card', _card_key,
          jsonb_build_object('from_package', _old.package, 'to_package', _package,
                             'from_module', _old.module_key, 'to_module', _module_key,
                             'description_changed', _old.description is distinct from _desc));
end;
$$;
revoke execute on function public.admin_set_card_entry(text, text, text, text) from public, anon;
grant execute on function public.admin_set_card_entry(text, text, text, text) to authenticated;

create or replace function public.admin_set_card_module(_module_key text, _label text, _description text)
returns void language plpgsql security definer set search_path = public as $$
declare _l text := btrim(coalesce(_label, '')); _d text := btrim(coalesce(_description, ''));
begin
  perform public.assert_super_admin();
  if char_length(_l) not between 1 and 60 or char_length(_d) > 300 then
    raise exception 'INVALID_MODULE_TEXT' using errcode = 'check_violation';
  end if;
  update public.card_modules set label = _l, description = _d, updated_at = now(), updated_by = auth.uid()
   where module_key = _module_key;
  if not found then raise exception 'NO_SUCH_MODULE' using errcode = 'no_data_found'; end if;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'card_module_changed', 'card_module', _module_key, jsonb_build_object('label', _l));
end;
$$;
revoke execute on function public.admin_set_card_module(text, text, text) from public, anon;
grant execute on function public.admin_set_card_module(text, text, text) to authenticated;

-- Module tick: a grouping over the same client_cards list. Only cards the
-- purchase currently allows are added; nothing else changes.
create or replace function public.set_client_module(_client_id uuid, _module_key text, _enabled boolean)
returns text[] language plpgsql security definer set search_path = public as $$
declare _firm uuid; _cards text[]; _avail text[]; _base text[];
begin
  perform app_private.assert_aal2();
  select c.firm_id into _firm from public.clients c where c.id = _client_id;
  if not found then raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege'; end if;
  perform app_private.assert_card_manager(_firm);

  select coalesce(array(select cc.card_key from public.card_catalogue cc where cc.module_key = _module_key), '{}'::text[]) into _cards;
  if cardinality(_cards) = 0 then raise exception 'NO_SUCH_MODULE' using errcode = 'check_violation'; end if;

  _avail := app_private.client_available_cards(_client_id);
  if coalesce(_enabled, false) and not (_cards && _avail) then
    raise exception 'CARD_NOT_AVAILABLE' using errcode = 'check_violation';
  end if;

  select x.cards into _base from public.client_cards x where x.client_id = _client_id;
  if _base is null then _base := _avail; end if;

  if coalesce(_enabled, false) then
    _base := _base || array(select u from unnest(_cards) u where u = any(_avail));
  else
    _base := array(select u from unnest(_base) u where not (u = any(_cards)));
  end if;
  perform app_private.set_client_cards(_client_id, _base);

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm, 'client_module_toggled', 'client', _client_id::text,
          jsonb_build_object('module', _module_key, 'enabled', coalesce(_enabled, false)));
  return app_private.client_cards_v2(_client_id);
end;
$$;
revoke execute on function public.set_client_module(uuid, text, boolean) from public, anon;
grant execute on function public.set_client_module(uuid, text, boolean) to authenticated;

-- Existing card writes: Staff (and legacy client owner) no longer allowed;
-- Organisation Owner or System Administrator only.
create or replace function public.set_client_card_enabled(_client_id uuid, _card text, _enabled boolean)
returns text[] language plpgsql security definer set search_path = public as $$
declare _base text[]; _firm uuid;
begin
  perform app_private.assert_aal2();
  select c.firm_id into _firm from public.clients c where c.id = _client_id;
  if not found then raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege'; end if;
  perform app_private.assert_card_manager(_firm);

  if _card is null or _card = '' then
    raise exception 'INVALID_CARD' using errcode = 'check_violation';
  end if;
  if coalesce(_enabled,false)
     and not (_card = any(app_private.client_available_cards(_client_id))) then
    raise exception 'CARD_NOT_AVAILABLE' using errcode = 'check_violation';
  end if;

  select cc.cards into _base from public.client_cards cc where cc.client_id = _client_id;
  if _base is null then _base := app_private.client_available_cards(_client_id); end if;
  if coalesce(_enabled,false) then _base := _base || array[_card];
  else _base := array_remove(_base, _card); end if;
  perform app_private.set_client_cards(_client_id, _base);

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm, 'client_card_toggled', 'client', _client_id::text,
          jsonb_build_object('card', _card, 'enabled', coalesce(_enabled,false)));
  return app_private.client_cards_v2(_client_id);
end;
$$;

create or replace function public.copy_client_cards(_from_client_id uuid, _to_client_ids uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare _firm uuid; _cards text[]; _target uuid; _target_firm uuid; _n int := 0;
begin
  perform app_private.assert_aal2();
  select c.firm_id into _firm from public.clients c where c.id = _from_client_id;
  if _firm is null then
    raise exception 'SOURCE_HAS_NO_ORGANISATION' using errcode = 'check_violation';
  end if;
  perform app_private.assert_card_manager(_firm);

  select cc.cards into _cards from public.client_cards cc where cc.client_id = _from_client_id;
  if _cards is null then _cards := app_private.client_available_cards(_from_client_id); end if;

  foreach _target in array coalesce(_to_client_ids, '{}'::uuid[]) loop
    if _target = _from_client_id then continue; end if;
    select c.firm_id into _target_firm from public.clients c where c.id = _target;
    if _target_firm is distinct from _firm then
      raise exception 'DIFFERENT_ORGANISATION' using errcode = 'insufficient_privilege';
    end if;
    perform app_private.set_client_cards(_target, _cards);
    insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
    values (auth.uid(), _firm, 'client_cards_copied', 'client', _target::text,
            jsonb_build_object('from_client_id', _from_client_id, 'cards', to_jsonb(_cards)));
    _n := _n + 1;
  end loop;
  return _n;
end;
$$;

create or replace function public.set_org_card_defaults(_firm_id uuid, _cards text[])
returns text[] language plpgsql security definer set search_path = public as $$
declare _clean text[]; _allowed text[]; _adv boolean; _cons boolean; _n int;
begin
  perform app_private.assert_aal2();
  perform app_private.assert_card_manager(_firm_id);
  if not exists (select 1 from public.firms f where f.id = _firm_id) then
    raise exception 'NO_SUCH_ORGANISATION' using errcode = 'no_data_found';
  end if;
  select e.advisory, e.consolidation into _adv, _cons from app_private.org_effective_options(_firm_id) e;
  select count(*)::int into _n from public.clients c where c.firm_id = _firm_id;
  _allowed := app_private.card_group_cards('standard')
    || case when coalesce(_adv, false) then app_private.card_group_cards('advisory') else '{}'::text[] end
    || case when coalesce(_cons, false) and _n > 1 then app_private.card_group_cards('consolidation') else '{}'::text[] end;
  _clean := coalesce(array(
    select distinct x from unnest(coalesce(_cards, '{}'::text[])) x
     where x = any(app_private.known_cards()) and x = any(_allowed)
     order by x
  ), '{}'::text[]);
  insert into public.org_card_defaults (firm_id, cards) values (_firm_id, _clean)
  on conflict (firm_id) do update set cards = excluded.cards, updated_at = now();
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm_id, 'org_card_defaults_set', 'firm', _firm_id::text,
          jsonb_build_object('cards', to_jsonb(_clean)));
  return _clean;
end;
$$;

create or replace function public.apply_org_card_defaults(_firm_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare _cards text[]; _client uuid; _n int := 0;
begin
  perform app_private.assert_aal2();
  perform app_private.assert_card_manager(_firm_id);
  select d.cards into _cards from public.org_card_defaults d where d.firm_id = _firm_id;
  if _cards is null then raise exception 'NO_DEFAULT_SET' using errcode = 'no_data_found'; end if;
  for _client in select c.id from public.clients c where c.firm_id = _firm_id loop
    perform app_private.set_client_cards(_client, _cards);
    _n := _n + 1;
  end loop;
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm_id, 'org_card_defaults_applied', 'firm', _firm_id::text,
          jsonb_build_object('clients_changed', _n, 'cards', to_jsonb(_cards)));
  return _n;
end;
$$;

-- Legacy (v1 rollback) card writers: same owner/System Administrator gate added
-- on top of their existing membership gate, so Staff cannot bypass the new rule.
create or replace function public.set_client_tier_widgets(_client_id uuid, _tier text, _excluded text[], _clear boolean)
returns void language plpgsql security definer set search_path = public, app_private as $$
declare _uid uuid := auth.uid(); _firm_id uuid; _existing_id uuid;
begin
  perform app_private.assert_aal2();
  if _uid is null then raise exception 'NO_ACCESS' using errcode='insufficient_privilege'; end if;
  select c.firm_id into _firm_id from public.clients c where c.id = _client_id;
  perform app_private.assert_card_manager(_firm_id);
  if not exists (
    select 1 from public.clients c where c.id = _client_id
      and (c.owner_user_id = _uid or (c.firm_id is not null and app_private.has_firm_access(_uid, c.firm_id)))
  ) then raise exception 'NO_ACCESS' using errcode='insufficient_privilege'; end if;

  if _clear then
    delete from public.tier_widget_config where client_id = _client_id and tier = _tier;
    perform app_private.set_client_cards(_client_id, app_private.client_available_cards(_client_id));
    insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
    values (_uid, _firm_id, 'client_widget_config_saved', 'tier_widget_config', _client_id::text,
            jsonb_build_object('tier', _tier, 'cleared', true));
    return;
  end if;

  select id into _existing_id from public.tier_widget_config where tier = _tier and client_id = _client_id;
  if _existing_id is not null then
    update public.tier_widget_config set excluded_widgets = _excluded where id = _existing_id;
  else
    insert into public.tier_widget_config (client_id, firm_id, tier, excluded_widgets) values (_client_id, null, _tier, _excluded);
  end if;
  perform app_private.set_client_cards(_client_id, coalesce(array(
    select x from unnest(app_private.client_available_cards(_client_id)) as x
     where not (x = any(coalesce(_excluded, '{}'::text[])))), '{}'::text[]));
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (_uid, _firm_id, 'client_widget_config_saved', 'tier_widget_config', _client_id::text,
          jsonb_build_object('tier', _tier, 'excluded_widgets', _excluded));
end;
$$;

create or replace function public.set_org_widget_enabled(_firm_id uuid, _tier text, _widget text, _enabled boolean)
returns table(clients_affected integer) language plpgsql security definer set search_path = public, app_private as $$
declare _uid uuid := auth.uid(); _n int := 0; _base text[];
begin
  perform app_private.assert_aal2();
  perform app_private.assert_card_manager(_firm_id);
  if _uid is null or not app_private.has_firm_access(_uid, _firm_id) then
    raise exception 'NO_ACCESS' using errcode='insufficient_privilege';
  end if;
  select coalesce(
    (select excluded_widgets from public.tier_widget_config where client_id is null and firm_id = _firm_id and tier = _tier),
    (select excluded_widgets from public.tier_widget_config where client_id is null and firm_id is null and tier = _tier),
    '{}'::text[]) into _base;
  if _enabled then _base := array_remove(_base, _widget);
  else _base := (select array(select distinct u from unnest(_base || array[_widget]) u)); end if;
  insert into public.tier_widget_config (firm_id, tier, widgets, excluded_widgets)
  values (_firm_id, _tier, '{}', _base)
  on conflict (firm_id, tier) where client_id is null and firm_id is not null
  do update set excluded_widgets = _base, updated_at = now();
  if _enabled then
    update public.tier_widget_config t
       set excluded_widgets = array_remove(t.excluded_widgets, _widget), updated_at = now()
     where t.client_id in (select id from public.clients where firm_id = _firm_id)
       and t.tier = _tier and _widget = any(t.excluded_widgets);
    get diagnostics _n = row_count;
  end if;
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, meta)
  values (_uid, _firm_id, 'org_widget_toggled', 'tier_widget_config',
          jsonb_build_object('tier',_tier,'widget',_widget,'enabled',_enabled,'client_overrides_cleared',_n));
  return query select _n;
end;
$$;

create or replace function public.set_client_widget_enabled(_client_id uuid, _widget text, _enabled boolean)
returns table(effective_tier text, is_enabled boolean) language plpgsql security definer set search_path = public, app_private as $$
declare _uid uuid := auth.uid(); _tier text; _firm uuid; _excl text[]; _in_tier boolean;
begin
  perform app_private.assert_aal2();
  if _uid is null then raise exception 'NO_ACCESS' using errcode='insufficient_privilege'; end if;
  select c.firm_id into _firm from public.clients c where c.id = _client_id;
  perform app_private.assert_card_manager(_firm);
  if not exists (
    select 1 from public.clients c where c.id = _client_id
      and (c.owner_user_id = _uid or (c.firm_id is not null and app_private.has_firm_access(_uid, c.firm_id)))
  ) then raise exception 'NO_ACCESS' using errcode='insufficient_privilege'; end if;

  select e.tier::text into _tier from public.client_entitlement(_client_id) e;
  select (_widget = any(pl.widgets)) into _in_tier from public.plan_levels pl
   where pl.scope='dashboard' and pl.key = _tier and pl.enabled;
  if _enabled and not coalesce(_in_tier,false) then
    raise exception 'NOT_IN_TIER: % is not part of the % dashboard', _widget, _tier using errcode='check_violation';
  end if;
  select coalesce(twc.excluded_widgets,'{}') into _excl from public.tier_widget_config twc
   where twc.client_id = _client_id and twc.tier = _tier;
  if _enabled then _excl := array_remove(coalesce(_excl,'{}'), _widget);
  else _excl := (select array(select distinct u from unnest(coalesce(_excl,'{}') || array[_widget]) u)); end if;
  insert into public.tier_widget_config (client_id, tier, widgets, excluded_widgets)
  values (_client_id, _tier, '{}', _excl)
  on conflict (client_id, tier) where client_id is not null
  do update set excluded_widgets = _excl, updated_at = now();
  perform app_private.set_client_card(_client_id, _widget, _enabled);
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (_uid, _firm, 'client_widget_toggled', 'client', _client_id::text,
          jsonb_build_object('widget',_widget,'enabled',_enabled,'tier',_tier));
  return query select _tier, public.client_can_use_widget(_client_id, _widget);
end;
$$;

-- Public website reads module names and card descriptions from the same
-- catalogue, through the existing anon display reader (copy only).
create or replace function public.get_public_website_settings()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object('calendlyUrl',b.website_settings->>'calendlyUrl','heroVideoPath',b.website_settings->>'heroVideoPath','heroPosterPath',b.website_settings->>'heroPosterPath','walkthroughUrl',b.website_settings->>'walkthroughUrl','standardPrice',b.website_settings->>'standardPrice','advisoryPrice',b.website_settings->>'advisoryPrice','consolidationPrice',b.website_settings->>'consolidationPrice','whiteLabelPrice',b.website_settings->>'whiteLabelPrice')
      from public.platform_branding b where b.id = true
  ), '{}'::jsonb)
  || jsonb_build_object(
    'packages', jsonb_build_object(
      'modules', coalesce((select jsonb_agg(jsonb_build_object('key', m.module_key, 'label', m.label, 'description', m.description) order by m.sort_order, m.module_key) from public.card_modules m), '[]'::jsonb),
      'cards', coalesce((select jsonb_agg(jsonb_build_object('package', c.package, 'module', c.module_key, 'label', c.label, 'description', c.description) order by c.sort_order, c.card_key) from public.card_catalogue c), '[]'::jsonb)
    )
  )
$$;