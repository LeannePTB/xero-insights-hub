# Baseline invoice revenue vs Trading Income

## Why they differ

It isn't the reporting basis — both are accrual. It's GST.

- Trading Income (P&L): **A$28,057** — GST-exclusive, as Xero always reports the P&L.
- Baseline invoice revenue: **A$30,863** — the invoice **Total**, which includes GST.

A$30,863 ÷ 1.1 = A$28,057.27. The gap is exactly the 10% GST, so the two figures are the same revenue measured differently.

## The fix

Use the GST-exclusive invoice value everywhere in the Cashflow Scenario so it lines up with the P&L:

- Take each invoice's net amount (total less tax) instead of the tax-inclusive total.
- This flows through automatically to baseline revenue, scenario revenue, the revenue-by-customer matrix, the difference tile and Net Position.
- Label the tiles "excl. GST" so it's explicit.

Small residual differences can remain when an invoice is dated in the month but coded to a non-trading-income account (or vice versa); the existing note under the P&L strip already covers that.

## Technical notes

- `src/lib/xero/scenario.functions.ts`: read `SubTotal` from the Xero Invoices payload (fall back to `Total - TotalTax`, then `Total`) when building `ScenarioInvoice.amount`.
- No schema or calculation-layer changes; `scenario-calc.ts` consumes the same field.
- `clients.$clientId.cashflow-scenario.tsx` and `ScenarioWidget.tsx`: add the "excl. GST" wording to the revenue tiles.
