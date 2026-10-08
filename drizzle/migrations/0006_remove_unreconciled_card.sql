-- Remove the Uncoded Bankfeed Questions card (key 'unreconciled') entirely:
-- the practice will not use it. Mirrors the 20 Sep 2026 removal of
-- bank_reconciliation/tax_liability.
--
-- Presentation/catalogue only: no policy, grant, role, entitlement or
-- authorisation rule changes. Legacy rollback rows (plan_levels,
-- tier_widget_config, firms.default_widgets) are deliberately left untouched.
-- The unreconciled_uploads / unreconciled_lines tables stay (RLS unchanged);
-- nothing links to them any more.

-- 1. The catalogue: the three purchasable groups, minus 'unreconciled'.
create or replace function app_private.card_group_cards(_group text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case _group
    when 'standard' then array['health','receivables','payables','pnl','notes']
    when 'advisory' then array['cashflow','cashflow_scenario','accounting_breakeven','true_breakeven','gst_reconciliation','superannuation','payg_withholding','xero_audit','transaction_search']
    when 'consolidation' then array['loan_consolidation']
    else '{}'::text[]
  end
$$;
revoke execute on function app_private.card_group_cards(text) from anon;

-- 2. Every client's ticked list, and any organisation card template.
with removed as (
  select cc.client_id,
         cardinality(cc.cards) as before_count,
         array(select x from unnest(cc.cards) x
                where x <> 'unreconciled') as kept
  from public.client_cards cc
  where cc.cards && array['unreconciled']
), upd as (
  update public.client_cards cc
     set cards = r.kept, updated_at = now()
    from removed r
   where cc.client_id = r.client_id
  returning cc.client_id, r.before_count, cardinality(r.kept) as after_count
)
insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
select null, null, 'card_catalogue_cards_removed', 'card', 'unreconciled',
       jsonb_build_object(
         'cards', jsonb_build_array('unreconciled'),
         'reason', 'card retired; practice will not use Uncoded Bankfeed Questions',
         'clients_changed', count(*),
         'ticks_removed', coalesce(sum(before_count - after_count), 0)
       )
  from upd;

update public.org_card_defaults
   set cards = array(select x from unnest(cards) x
                      where x <> 'unreconciled'),
       updated_at = now()
 where cards && array['unreconciled'];