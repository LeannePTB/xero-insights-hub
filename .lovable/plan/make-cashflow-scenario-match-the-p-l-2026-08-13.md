# Make Cashflow Scenario match the P&L

## What's wrong

Positive Traction's client record is set to **cash** reporting basis. The Cashflow Scenario asks Xero for a payments-only P&L when the basis is cash, so accrual-only lines — Wages & Salaries and Superannuation (together $16,620.66 of Cost of Sales in July 2026) — never come back. Everything else on the card is then understated by the same amount.

The uploaded July P&L is on the accrual basis, which is the basis the rest of the dashboards use.

## The fix

1. **Run the Scenario P&L on accrual.** Drop the payments-only request from the scenario data fetch so wages, super and other accrued costs are included, matching the P&L report. Show an "Accrual" badge on the card and page so it's clear which basis the numbers use.

2. **Show Cost of Sales separately.** Tag each expense line with the P&L section it came from (Cost of Sales vs Operating Expenses) and render three expense groups on the scenario page: Cost of Sales, Fixed, Variable. Wages and Super stop being buried in a single lump.

3. **Add a P&L reconciliation strip** to the scenario page: Trading Income, Cost of Sales, Gross Profit, Operating Expenses, Net Profit for the selected month, straight from the same P&L — so it can be eyeballed against the Xero report. Scenario exclusions still drive the "what-if" revenue figures below it.

4. **Keep invoice-based revenue as the scenario input**, but label the two revenue numbers clearly (P&L Trading Income vs scenario invoice revenue) so a difference between them reads as expected rather than as a bug.

## Technical notes

- `src/lib/xero/scenario.functions.ts`: remove the `paymentsOnly` branch (or hard-set accrual), extend `parseMonthlyExpenses` to return the section title, add `section: "cogs" | "operating"` to `ScenarioExpense`, and return P&L section totals per month in `ScenarioData`.
- `src/lib/scenario-calc.ts`: add a cost-of-sales bucket to `computeTotals` and allow `groupExpenses` to filter by section.
- `src/routes/_authenticated/clients.$clientId.cashflow-scenario.tsx`: new reconciliation strip, third expense group, basis badge.
- `src/components/dashboard/ScenarioWidget.tsx`: stat tiles reflect the new totals.
- No database or schema changes; the client's cash basis stays as-is for other widgets.
