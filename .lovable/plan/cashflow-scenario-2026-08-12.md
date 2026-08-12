# Cashflow Scenario

A new Advisory-tier widget that lets a business owner see money in vs money out by month, and toggle individual invoices off to instantly see the impact on their net position. It keeps its own list of customers, invoices and expenses (saved in the database), and can pull invoices in from the connected Xero file.

## Where it appears

- New widget `Cashflow Scenario`, added to the widget catalogue and included in the Advisory tier (and above). It shows in the client dashboard card grid like the other widgets, and can be turned on/off per tier in Tier widgets.
- The card shows the headline numbers (Baseline, Current scenario, Difference, Net Position) plus a compact revenue-by-month strip.
- A full page at `/clients/<id>/cashflow-scenario` holds the full experience: client matrix, month drill-down, expenses, and all add/edit/delete forms.

## What it stores

Four new tables, all scoped to a client (so each business has its own data) and protected so only that client's advisors and viewers can see them:

- Customers: name.
- Invoices: customer, description, amount, issue date, status (Paid / Pending / Overdue), excluded flag (default off), plus an optional link back to the Xero invoice it came from.
- Expenses: name, amount, type (Fixed or Variable), category, date, recurring-monthly flag.
- Settings: currency symbol/code, defaulting to AUD.

Exclusions are stored on the invoice row, so the scenario is shared — everyone looking at that client sees the same scenario, and it persists between sessions.

## Views

**Summary strip (top)**
For the selected month and for the full year: Total Revenue, Total Fixed Expenses, Total Variable Expenses, Net Position (green when positive, red when negative).
Alongside it: **Baseline** (every invoice counted), **Current scenario** (exclusions applied) and the **Difference**, plus a **Reset scenario** button that re-includes everything at once.

**Revenue by customer per month**
Matrix table: customers down the side, months across the top, totals invoiced in each cell, with a total row and total column. Excluded invoices are left out of every total. A month selector drills into that month's invoice list.

**Invoice lists**
Every invoice row has an exclude toggle. Excluded invoices stay visible, greyed out, with an "Excluded" tag. Add / edit / delete for invoices and customers.

**Expenses**
Split into Fixed and Variable, grouped by category within each, with a subtotal per section and a combined total. Add / edit / delete.

Simple bar charts for revenue by month and expenses by category, using the existing chart styling.

## Xero connection

A **Import from Xero** action on the page pulls sales invoices (ACCREC) from the client's linked Xero organisation for a chosen date range:

- Xero contacts become customers (matched by name, created if new).
- Each Xero invoice becomes an invoice row with amount, date, reference/description, and a status mapped from Xero (Paid / Pending / Overdue by due date).
- Re-importing updates rows that came from Xero rather than duplicating them, and never clears an exclusion you've set.
- Manually added invoices and all expenses are untouched by imports.

Expenses stay manual in this build (Xero bills can be added later if you want them).

## Seed data

The first time a client opens the page with no data, an example set is created for them: a few customers, invoices spread across several months, and a mix of fixed and variable expenses — so the dashboard is immediately useful before any Xero import.

## Technical notes

- Tables `scenario_customers`, `scenario_invoices`, `scenario_expenses`, `scenario_settings` in a migration, each with `client_id`, timestamps, `updated_at` trigger, GRANTs and RLS mirroring the existing client-scoped tables (advisor/firm member access, client viewers read-write on their own client).
- Server functions in `src/lib/scenario.functions.ts` (CRUD, toggle exclude, reset scenario, settings) using `requireSupabaseAuth`; aggregation done server-side and returned as a ready-to-render DTO.
- Xero import in `src/lib/scenario-xero.functions.ts`, reusing the existing `src/lib/xero/api.server.ts` client and tenant access checks.
- New widget key `cashflow_scenario` added to `src/lib/tiers.ts` (`ALL_WIDGETS`, `WIDGET_LABEL`, advisory defaults) and rendered in `clients.$clientId.index.tsx`'s card list.
- Currency formatting via the existing `formatMoney` helper, with the scenario setting overriding the Xero base currency.
