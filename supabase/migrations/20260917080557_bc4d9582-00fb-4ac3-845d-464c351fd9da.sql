-- Organisation card defaults: a TEMPLATE applied at client creation.
-- Never consulted when resolving a dashboard. Card resolution stays exactly
-- app_private.client_cards_v2: the purchase, intersected with the one ticked
-- list stored for that client.

create table if not exists public.org_card_defaults (
  firm_id uuid primary key references public.firms(id) on delete cascade,
  cards text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table public.org_card_defaults from anon, authenticated;
grant select on table public.org_card_defaults to authenticated;
grant all on table public.org_card_defaults to service_role;

alter table public.org_card_defaults enable row level security;

-- Read only, and only through the caller's own path to the organisation.
-- Every write goes through the guarded functions below, never the table.
create policy "org card defaults readable by organisation access"
  on public.org_card_defaults
  for select
  to authenticated
  using (app_private.is_aal2() and app_private.has_firm_access(auth.uid(), firm_id));

create trigger tg_set_updated_at
  before update on public.org_card_defaults
  for each row execute function public.tg_set_updated_at();

-- Known card keys only: the three purchase groups are the catalogue.
create or replace function app_private.known_cards()
returns text[]
language sql
immutable
set search_path to 'public'
as $$
  select app_private.card_group_cards('standard')
      || app_private.card_group_cards('advisory')
      || app_private.card_group_cards('consolidation')
$$;

-- Membership-only write gate. Deliberately NOT has_firm_access, which admits a
-- read-only support grant (invariant 5), and NOT super admin on its own
-- (invariant 3).
create or replace function app_private.assert_firm_member_write(_firm_id uuid)
returns void
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null or _firm_id is null then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.firms f where f.id = _firm_id and f.owner_user_id = _uid
  ) and not exists (
    select 1 from public.firm_members m
     where m.firm_id = _firm_id and m.user_id = _uid and m.status = 'active'
  ) then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- Read: the stored template, and whether one is set at all.
create or replace function public.org_card_defaults(_firm_id uuid)
returns table(firm_id uuid, cards text[], configured boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  _cards text[];
begin
  perform app_private.assert_aal2();
  if _firm_id is null or not app_private.has_firm_access(auth.uid(), _firm_id) then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;

  select d.cards into _cards from public.org_card_defaults d where d.firm_id = _firm_id;

  return query select _firm_id, coalesce(_cards, '{}'::text[]), _cards is not null;
end;
$$;

-- Write the template. Changes no client.
create or replace function public.set_org_card_defaults(_firm_id uuid, _cards text[])
returns text[]
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _clean text[];
begin
  perform app_private.assert_aal2();
  perform app_private.assert_firm_member_write(_firm_id);

  if not exists (select 1 from public.firms f where f.id = _firm_id) then
    raise exception 'NO_SUCH_ORGANISATION' using errcode = 'no_data_found';
  end if;

  _clean := coalesce(array(
    select distinct x from unnest(coalesce(_cards, '{}'::text[])) x
     where x = any(app_private.known_cards())
     order by x
  ), '{}'::text[]);

  insert into public.org_card_defaults (firm_id, cards)
  values (_firm_id, _clean)
  on conflict (firm_id) do update set cards = excluded.cards, updated_at = now();

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm_id, 'org_card_defaults_set', 'firm', _firm_id::text,
          jsonb_build_object('cards', to_jsonb(_clean)));

  return _clean;
end;
$$;

-- Apply the template to every existing client in the organisation, replacing
-- their ticked lists. Audited with the exact number changed.
create or replace function public.apply_org_card_defaults(_firm_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _cards text[];
  _client uuid;
  _n int := 0;
begin
  perform app_private.assert_aal2();
  perform app_private.assert_firm_member_write(_firm_id);

  select d.cards into _cards from public.org_card_defaults d where d.firm_id = _firm_id;
  if _cards is null then
    raise exception 'NO_DEFAULT_SET' using errcode = 'no_data_found';
  end if;

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

revoke execute on function public.org_card_defaults(uuid) from public, anon;
revoke execute on function public.set_org_card_defaults(uuid, text[]) from public, anon;
revoke execute on function public.apply_org_card_defaults(uuid) from public, anon;
revoke execute on function app_private.known_cards() from public, anon;
revoke execute on function app_private.assert_firm_member_write(uuid) from public, anon;
grant execute on function public.org_card_defaults(uuid) to authenticated;
grant execute on function public.set_org_card_defaults(uuid, text[]) to authenticated;
grant execute on function public.apply_org_card_defaults(uuid) to authenticated;

-- Creation copies the template into the new client's own list, in the same
-- transaction as the insert, on every creation path. No template, no row —
-- which app_private.client_cards_v2 already treats as "all available".
create or replace function app_private.seed_client_cards_from_org_default()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _cards text[];
begin
  if new.firm_id is not null then
    select d.cards into _cards from public.org_card_defaults d where d.firm_id = new.firm_id;
    if _cards is not null then
      perform app_private.set_client_cards(new.id, _cards);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists tg_seed_client_cards_from_org_default on public.clients;
create trigger tg_seed_client_cards_from_org_default
  after insert on public.clients
  for each row execute function app_private.seed_client_cards_from_org_default();

-- One rule, not two: switching an option on ticks its cards for every client in
-- the organisation AND for the template new clients start from.
create or replace function public.set_org_purchase(_firm_id uuid, _client_limit integer, _advisory boolean, _consolidation boolean, _branding boolean, _billing_mode text)
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

    update public.org_card_defaults d
       set cards = array(select distinct x
                           from unnest(d.cards || app_private.card_group_cards('advisory')) x
                          order by x),
           updated_at = now()
     where d.firm_id = _firm_id;
  end if;

  select count(*) into _siblings from public.clients c where c.firm_id = _firm_id;
  if coalesce(_consolidation,false) and not coalesce(_prev_consolidation,false) and _siblings > 1 then
    update public.client_cards cc
       set cards = array(select distinct x
                           from unnest(cc.cards || app_private.card_group_cards('consolidation')) x
                          order by x),
           updated_at = now()
     where cc.client_id in (select c.id from public.clients c where c.firm_id = _firm_id);

    update public.org_card_defaults d
       set cards = array(select distinct x
                           from unnest(d.cards || app_private.card_group_cards('consolidation')) x
                          order by x),
           updated_at = now()
     where d.firm_id = _firm_id;
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

-- Retire the v1 organisation default. The column firms.default_widgets stays as
-- rollback data; nothing reads or writes it any more.
drop function if exists public.set_firm_default_widgets(uuid, text[]);