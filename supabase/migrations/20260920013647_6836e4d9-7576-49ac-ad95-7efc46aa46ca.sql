-- Remove two cards the app has no component for: bank_reconciliation and
-- tax_liability. Both were offerable and tickable, and neither has ever drawn a
-- card. Tax Liability was superseded by the GST activity statement and PAYG
-- Withholding cards; Bank Reconciliation by Uncoded Bankfeed Questions, so no
-- capability is lost.
--
-- Presentation/catalogue only: no policy, grant, role, entitlement or
-- authorisation rule changes. Legacy rollback rows (plan_levels,
-- tier_widget_config, firms.default_widgets) are deliberately left untouched.

-- 1. The catalogue: the three purchasable groups, minus the two dead keys.
create or replace function app_private.card_group_cards(_group text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case _group
    when 'standard' then array['health','receivables','payables','pnl','notes','unreconciled']
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
                where x not in ('bank_reconciliation','tax_liability')) as kept
  from public.client_cards cc
  where cc.cards && array['bank_reconciliation','tax_liability']
), upd as (
  update public.client_cards cc
     set cards = r.kept, updated_at = now()
    from removed r
   where cc.client_id = r.client_id
  returning cc.client_id, r.before_count, cardinality(r.kept) as after_count
)
insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
select null, null, 'card_catalogue_cards_removed', 'card', 'bank_reconciliation,tax_liability',
       jsonb_build_object(
         'cards', jsonb_build_array('bank_reconciliation','tax_liability'),
         'reason', 'no component exists; superseded by gst_reconciliation + payg_withholding and unreconciled',
         'clients_changed', count(*),
         'ticks_removed', coalesce(sum(before_count - after_count), 0)
       )
  from upd;

update public.org_card_defaults
   set cards = array(select x from unnest(cards) x
                      where x not in ('bank_reconciliation','tax_liability')),
       updated_at = now()
 where cards && array['bank_reconciliation','tax_liability'];