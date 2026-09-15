# Card configuration — pre-migration snapshot

Taken 15 September 2026, before any part of the subscription-and-card-model migration.

Purpose: a **reference only**, so the owner can put something back by hand if she wants to. Per the owner's amendment of 15 September, this is *not* a fidelity target — the backfill switches every allowed card on and the owner adjusts each client afterwards. No attempt is made here to derive exactly what each client sees today.

## Consolidation working data — baseline counts (assert unchanged before and after every migration)

| Table | Rows |
| --- | --- |
| `loan_consolidation_accounts` | 56 |
| `consolidation_group_members` | 9 |
| `consolidation_groups` | 1 |
| `loan_consolidation_snapshots` | 1 |

Any change to these four numbers is a stop condition.

## `plan_levels` (scope `dashboard`)

| Tier | Cards |
| --- | --- |
| basic | health, receivables, payables, pnl, notes |
| advisory | health, receivables, payables, pnl, tax_liability, superannuation, accounting_breakeven, true_breakeven, cashflow, xero_audit, notes, bank_reconciliation, gst_reconciliation, transaction_search, payg_withholding, cashflow_scenario |
| multi_company | health, receivables, payables, pnl, tax_liability, superannuation, accounting_breakeven, true_breakeven, cashflow, cashflow_scenario, xero_audit, loan_consolidation, notes, bank_reconciliation, gst_reconciliation, transaction_search, payg_withholding |

## `tier_widget_config`

| Organisation | Client | Tier | `widgets` | `excluded_widgets` |
| --- | --- | --- | --- | --- |
| (platform default) | (all clients) | advisory | tax_liability, gst_reconciliation, notes, xero_audit, cashflow_scenario, pnl, payables, receivables, superannuation, health, bank_reconciliation, unreconciled | transaction_search |
| (platform default) | (all clients) | basic | health, receivables, payables, pnl, unreconciled, notes | (none) |
| (platform default) | (all clients) | multi_company | xero_audit, pnl, payables, receivables, superannuation, health, bank_reconciliation, unreconciled, loan_consolidation, tax_liability, gst_reconciliation, notes | health, accounting_breakeven, true_breakeven, cashflow, cashflow_scenario, transaction_search, payg_withholding |
| (platform default) | Autotek New South Wales Pty Ltd | advisory | (none) | (none) |
| (platform default) | Positive Traction | advisory | cashflow_scenario, loan_consolidation, notes | health, receivables, payables, pnl, unreconciled, tax_liability, superannuation, accounting_breakeven, true_breakeven, cashflow, xero_audit, bank_reconciliation, gst_reconciliation |
| (platform default) | Positive Traction | basic | health, notes | receivables, payables, pnl, unreconciled |
| Autotek NSW | (all clients) | advisory | (none) | (none) |
| Autotek NSW | (all clients) | multi_company | (none) | unreconciled |
| DRTABT Projects | (all clients) | multi_company | (none) | unreconciled, cashflow, transaction_search, payg_withholding, cashflow_scenario, true_breakeven, accounting_breakeven, superannuation, health |

## `firms.default_widgets`

| Organisation | Value |
| --- | --- |
| Autotek NSW | (none) |
| Bangkok On Darby | (none) |
| DRTABT Projects | health, receivables, payables, pnl, notes, unreconciled, tax_liability, accounting_breakeven, true_breakeven, cashflow, cashflow_scenario, xero_audit, loan_consolidation, gst_reconciliation, superannuation |
| Positive Traction | (none) |
| ZZ Security Test Org | (none) |

## `clients.dashboard_widgets` (retired column, not read by resolution)

| Organisation | Client | Value |
| --- | --- | --- |
| Autotek NSW | Autotek New South Wales Pty Ltd | health, receivables, payables, pnl, notes |
| Bangkok On Darby | Bangkok on King | (none) |
| DRTABT Projects | DRTABT Projects Pty Ltd | receivables, payables, pnl, notes, unreconciled, xero_audit, loan_consolidation |
| DRTABT Projects | TracyFinlay | receivables, payables, pnl, unreconciled, accounting_breakeven, true_breakeven, cashflow, cashflow_scenario, xero_audit, loan_consolidation, notes |
| DRTABT Projects | X1 Enterprises Pty Ltd | receivables, payables, pnl, notes, unreconciled, accounting_breakeven, true_breakeven, cashflow, cashflow_scenario, xero_audit, loan_consolidation |
| DRTABT Projects | X12 ENTERPRISES PTY LTD & X13 ENTERPRISES PTY LTD | receivables, payables, pnl, notes, unreconciled, accounting_breakeven, true_breakeven, cashflow, cashflow_scenario, xero_audit, loan_consolidation |
| DRTABT Projects | X14 Enterprises Pty Ltd | receivables, payables, pnl, notes, unreconciled, accounting_breakeven, true_breakeven, cashflow, cashflow_scenario, xero_audit, loan_consolidation |
| DRTABT Projects | X16 X17 & X18 Enterprises Pty Ltd | (none) |
| DRTABT Projects | X3 Enterprises Pty Ltd | receivables, payables, pnl, notes, unreconciled, accounting_breakeven, true_breakeven, cashflow, cashflow_scenario, xero_audit, loan_consolidation |
| DRTABT Projects | X4 Enterprises Pty Ltd | receivables, payables, pnl, notes, unreconciled, accounting_breakeven, true_breakeven, cashflow, cashflow_scenario, xero_audit, loan_consolidation |
| DRTABT Projects | X5 Enterprises Pty Ltd | receivables, payables, pnl, notes, unreconciled, accounting_breakeven, true_breakeven, cashflow, cashflow_scenario, xero_audit, loan_consolidation |
| Positive Traction | Positive Traction | health, cashflow_scenario, xero_audit, loan_consolidation, notes |
| ZZ Security Test Org | ZZ Test Client One | (none) |
| ZZ Security Test Org | ZZ Test Client Two | (none) |

## Conflicting configuration (noted, deliberately not resolved)

- The platform `multi_company` row lists `health` in **both** `widgets` and `excluded_widgets`.
- Positive Traction has two per-client rows (`basic` and `advisory`) with conflicting sets; neither matches the tier the client actually resolves to.
- Null-`client_id` rows sit alongside per-client rows, and an empty organisation-level row (Autotek, `advisory`) silently cancels the platform exclusion rather than adding to it.
- `firms.default_widgets` is a third source, populated for DRTABT Projects only.
- Nine DRTABT clients carry per-client `dashboard_widgets` lists that differ from each other and from the retired column's intent.

These are exactly why the model is being replaced with one stored list per client and no exclusion mechanism.
