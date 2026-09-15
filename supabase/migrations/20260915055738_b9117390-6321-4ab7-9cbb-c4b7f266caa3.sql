-- Batch 2 of the subscription-and-card-model migration. Strictly additive.
-- Nothing existing is altered, dropped, renamed or repurposed. Nothing reads these objects yet.

-- 1. Instant-rollback switch. Reuses the existing app_private.platform_settings
--    (key text, value text), which is never exposed through the Data API.
revoke all on table app_private.platform_settings from public, anon, authenticated;
alter table app_private.platform_settings enable row level security;
-- No policies: readable only through security definer functions.

-- Batch 4 flips this to 'true' so card resolution reads client_cards.
-- Set it back to 'false' to reverse instantly, with no migration.
insert into app_private.platform_settings (key, value)
values ('card_model_v2', 'false')
on conflict (key) do nothing;

create or replace function app_private.setting_bool(_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select s.value = 'true' from app_private.platform_settings s where s.key = _key), false)
$$;
revoke execute on function app_private.setting_bool(text) from public, anon;

-- 2. Card groupings — the three purchasable groups, in one place.
create or replace function app_private.card_group_cards(_group text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case _group
    when 'standard' then array['health','receivables','payables','pnl','notes','unreconciled','bank_reconciliation']
    when 'advisory' then array['cashflow','cashflow_scenario','accounting_breakeven','true_breakeven','tax_liability','gst_reconciliation','superannuation','payg_withholding','xero_audit','transaction_search']
    when 'consolidation' then array['loan_consolidation']
    else '{}'::text[]
  end
$$;
revoke execute on function app_private.card_group_cards(text) from anon;

-- 3. Organisation purchase options.
create table if not exists public.org_subscription_options (
  firm_id uuid primary key references public.firms(id),
  client_limit integer not null default 1 check (client_limit >= 0),
  advisory_enabled boolean not null default false,
  consolidation_enabled boolean not null default false,
  billing_mode text not null default 'bookkeeping' check (billing_mode in ('bookkeeping','external')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on public.org_subscription_options from anon, authenticated;
grant select on public.org_subscription_options to authenticated;
grant all on public.org_subscription_options to service_role;
alter table public.org_subscription_options enable row level security;

create policy "org options readable by organisation access"
on public.org_subscription_options
for select
to authenticated
using (
  app_private.is_aal2()
  and (
    app_private.has_firm_access(auth.uid(), firm_id)
    or app_private.platform_staff_can_access_firm(auth.uid(), firm_id)
  )
);
-- No insert/update/delete policies: writes arrive in Batch 3 through aal2 definer functions only.

create trigger org_subscription_options_updated_at
before update on public.org_subscription_options
for each row execute function public.tg_set_updated_at();

-- Consolidation requires Advisory (design decision, 15 September 2026).
create or replace function public.enforce_consolidation_requires_advisory()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.consolidation_enabled and not new.advisory_enabled then
    raise exception 'CONSOLIDATION_REQUIRES_ADVISORY';
  end if;
  return new;
end;
$$;

create trigger org_subscription_options_consolidation_requires_advisory
before insert or update on public.org_subscription_options
for each row execute function public.enforce_consolidation_requires_advisory();

-- 4. One ticked card list per client. No exclusion list, ever.
create table if not exists public.client_cards (
  client_id uuid primary key references public.clients(id),
  cards text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on public.client_cards from anon, authenticated;
grant select on public.client_cards to authenticated;
grant all on public.client_cards to service_role;
alter table public.client_cards enable row level security;

create policy "client cards readable by client read access"
on public.client_cards
for select
to authenticated
using (
  app_private.is_aal2()
  and app_private.user_can_read_client(auth.uid(), client_id)
);
-- No insert/update/delete policies: writes arrive in Batch 3 through aal2 definer functions only.

create trigger client_cards_updated_at
before update on public.client_cards
for each row execute function public.tg_set_updated_at();

-- 5. What the organisation's purchase makes available for a client.
create or replace function app_private.client_available_cards(_client_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select cl.firm_id from public.clients cl where cl.id = _client_id
  ),
  o as (
    select opt.advisory_enabled, opt.consolidation_enabled
    from public.org_subscription_options opt
    where opt.firm_id = (select firm_id from c)
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
      || case when coalesce((select advisory_enabled from o), false) and not (select v from lapsed)
              then app_private.card_group_cards('advisory') else '{}'::text[] end
      || case when coalesce((select consolidation_enabled from o), false)
                   and not (select v from lapsed)
                   and (select n from siblings) > 1
              then app_private.card_group_cards('consolidation') else '{}'::text[] end
    ) as x
    order by x
  ), '{}'::text[])
$$;
revoke execute on function app_private.client_available_cards(uuid) from anon;

-- 6. What a client actually shows. A missing client_cards row means "all available",
--    never "none" — a recording fault must fail visible, not blank.
create or replace function public.client_visible_cards(_client_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  available text[];
  ticked text[];
begin
  perform app_private.assert_aal2();

  if not app_private.user_can_read_client(auth.uid(), _client_id) then
    raise exception 'CLIENT_ACCESS_DENIED';
  end if;

  available := app_private.client_available_cards(_client_id);
  select cc.cards into ticked from public.client_cards cc where cc.client_id = _client_id;

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
revoke execute on function public.client_visible_cards(uuid) from public, anon;
grant execute on function public.client_visible_cards(uuid) to authenticated;