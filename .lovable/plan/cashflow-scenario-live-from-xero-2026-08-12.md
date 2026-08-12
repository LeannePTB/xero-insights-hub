# Cashflow Scenario — live from Xero

Rework the Cashflow Scenario so it reads straight from the connected Xero file, exactly like Cash Flow, Receivables and the other widgets. No import button, no stored copy of invoices, customers or expenses.

## How it will work

- The widget and page take the client's Xero organisation and the shared date range (the same persistent month/period picker the other widgets use).
- Every time you open it, it fetches live from Xero:
  - **Revenue**: sales invoices (ACCREC, excluding drafts/voided/deleted) for the period, grouped by Xero contact and by month. Contacts become the rows of the revenue matrix — no separate customer list to maintain.
  - **Expenses**: the profit & loss expense accounts for the same months, split into **Fixed** and **Variable** using the cost classification tags already set in client Settings (anything untagged is treated as variable, same rule the Break-Even widget uses).
- Totals, Net Position, baseline vs scenario and the month drill-down are calculated from that live data.

## What stays saved

Only the scenario itself: which invoices you have switched off. That is stored as a short list of excluded Xero invoice IDs per client, so exclusions persist between sessions and are shared with anyone viewing that client. "Reset scenario" clears the list.

## What goes away

- The "Import from Xero" action.
- Manual add/edit/delete of customers, invoices and expenses, and the example seed data — the numbers are Xero's, so they aren't editable here.
- The four scenario tables holding copies of that data.

Currency comes from the Xero organisation's base currency, like the other widgets, so there is no currency setting to manage.

Error and loading behaviour matches the other Xero cards: the standard "load" prompt, reconnect notice and retry.

## Technical notes

- New `src/lib/xero/scenario.functions.ts`: `getScenarioData({ clientId, tenantId, from, to })` using `getConnectionByTenant` + `xeroGet` and `assertWidgetAccess(..., "cashflow_scenario")`. Pulls paged `Invoices` (ACCREC) and `Reports/ProfitAndLoss` per month, joins P&L account rows to `client_cost_classifications` for Fixed/Variable, and returns a ready-to-render DTO.
- Exclusions: single table `scenario_exclusions (client_id, xero_invoice_id)` with GRANTs and RLS via `app_private.has_client_access`; server fns `setInvoiceExcluded` / `resetScenario` kept, rewritten against it.
- Drop `scenario_customers`, `scenario_invoices`, `scenario_expenses`, `scenario_settings`; delete `src/lib/scenario-xero.functions.ts` and most of `src/lib/scenario.functions.ts`.
- `src/lib/scenario-calc.ts` retained for matrix/total building, retyped to the new DTO.
- `ScenarioWidget.tsx` and `clients.$clientId.cashflow-scenario.tsx` take `tenantId`/`tenantName`, use `DateRangeControls` + `XeroLoadPrompt`/`XeroErrorNotice`, and lose all the CRUD dialogs.
