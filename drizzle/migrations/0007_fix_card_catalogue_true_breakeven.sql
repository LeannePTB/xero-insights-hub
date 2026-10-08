-- Correct 0006_remove_unreconciled_card: its create-or-replace of
-- app_private.card_group_cards was copied from the 20 Sep 013647 migration and
-- accidentally re-added 'true_breakeven' to the advisory group, undoing the
-- retirement in 20260920045849. Restore the retired state: advisory without
-- 'true_breakeven', standard without 'unreconciled'.
create or replace function app_private.card_group_cards(_group text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case _group
    when 'standard' then array['health','receivables','payables','pnl','notes']
    when 'advisory' then array['cashflow','cashflow_scenario','accounting_breakeven','gst_reconciliation','superannuation','payg_withholding','xero_audit','transaction_search']
    when 'consolidation' then array['loan_consolidation']
    else '{}'::text[]
  end
$$;
revoke execute on function app_private.card_group_cards(text) from anon;