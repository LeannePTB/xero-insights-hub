-- Retire true_breakeven as a card choice. The input table and guarded
-- functions remain intact for a future rebuild.
--
-- Fail loudly if production no longer matches the independently verified
-- before state: nine affected clients at 16 cards and Positive Traction at 14.
create temporary table true_breakeven_before on commit drop as
select cc.client_id,
       c.name as client_name,
       cardinality(cc.cards) as before_count
  from public.client_cards cc
  join public.clients c on c.id = cc.client_id
 where 'true_breakeven' = any(cc.cards);

do $$
declare
  _total integer;
  _sixteen integer;
  _fourteen integer;
begin
  select count(*),
         count(*) filter (where before_count = 16),
         count(*) filter (where before_count = 14)
    into _total, _sixteen, _fourteen
    from true_breakeven_before;

  if _total <> 10 or _sixteen <> 9 or _fourteen <> 1 then
    raise exception 'TRUE_BREAKEVEN_BEFORE_MISMATCH: expected 10 clients (9 at 16 cards, 1 at 14); found % (% at 16, % at 14)',
      _total, _sixteen, _fourteen;
  end if;

  if not exists (
    select 1
      from true_breakeven_before
     where client_name = 'Positive Traction'
       and before_count = 14
  ) then
    raise exception 'TRUE_BREAKEVEN_BEFORE_MISMATCH: Positive Traction is not the verified 14-card row';
  end if;
end
$$;

create or replace function app_private.card_group_cards(_group text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case _group
    when 'standard' then array['health','receivables','payables','pnl','notes','unreconciled']
    when 'advisory' then array['cashflow','cashflow_scenario','accounting_breakeven','gst_reconciliation','superannuation','payg_withholding','xero_audit','transaction_search']
    when 'consolidation' then array['loan_consolidation']
    else '{}'::text[]
  end
$$;
revoke execute on function app_private.card_group_cards(text) from anon;

do $$
declare
  _changed integer;
begin
  update public.client_cards
     set cards = array_remove(cards, 'true_breakeven'),
         updated_at = now()
   where 'true_breakeven' = any(cards);

  get diagnostics _changed = row_count;
  if _changed <> 10 then
    raise exception 'TRUE_BREAKEVEN_UPDATE_MISMATCH: expected 10 changed clients, changed %', _changed;
  end if;
end
$$;

update public.org_card_defaults
   set cards = array_remove(cards, 'true_breakeven'),
       updated_at = now()
 where 'true_breakeven' = any(cards);

do $$
declare
  _remaining_clients integer;
  _remaining_defaults integer;
  _wrong_counts integer;
begin
  select count(*) into _remaining_clients
    from public.client_cards
   where 'true_breakeven' = any(cards);

  select count(*) into _remaining_defaults
    from public.org_card_defaults
   where 'true_breakeven' = any(cards);

  select count(*) into _wrong_counts
    from true_breakeven_before b
    join public.client_cards cc on cc.client_id = b.client_id
   where cardinality(cc.cards) <> b.before_count - 1;

  if _remaining_clients <> 0 or _remaining_defaults <> 0 or _wrong_counts <> 0 then
    raise exception 'TRUE_BREAKEVEN_AFTER_MISMATCH: % client ticks remain, % default ticks remain, % affected counts are wrong',
      _remaining_clients, _remaining_defaults, _wrong_counts;
  end if;
end
$$;

insert into public.audit_log
  (actor_user_id, firm_id, action, target_type, target_id, meta)
select null,
       null,
       'card_catalogue_card_removed',
       'card',
       'true_breakeven',
       jsonb_build_object(
         'card', 'true_breakeven',
         'reason', 'retired card choice; saved inputs and guarded functions retained for a future rebuild',
         'clients_changed', count(*),
         'ticks_removed', sum(before_count - cardinality(cc.cards)),
         'before_after', jsonb_agg(
           jsonb_build_object(
             'client_id', b.client_id,
             'client_name', b.client_name,
             'before', b.before_count,
             'after', cardinality(cc.cards)
           ) order by b.client_name
         )
       )
  from true_breakeven_before b
  join public.client_cards cc on cc.client_id = b.client_id;