# Cashflow Scenario: exclude one customer's invoices

Today the Invoices card only offers per-invoice switches plus "Exclude all (nobody paid)". Add the missing middle step: pick a single customer and model that this customer didn't pay.

## What changes

On the Invoices card, next to the existing buttons:

- A **customer dropdown** listing the customers who have invoices in the selected month (plus "Unassigned" when applicable).
- Two actions applied to the chosen customer only:
  - **Mark as unpaid** — excludes every invoice for that customer in the selected month.
  - **Mark as paid** — re-includes them.
- A **scope toggle** on the action: "This month" (default) or "All months shown", so a customer can be switched off across the whole matrix range in one click.
- Confirmation toast naming the customer and how many invoices changed, e.g. "Excluded 4 invoices for Acme Pty Ltd".
- The invoice matrix, monthly totals, and the invoice list all update immediately, and each affected invoice keeps its "Excluded" tag so it is clear what was changed.

"Exclude all" / "Include all" and per-invoice switches stay exactly as they are, and "Reset scenario" still clears everything.

## Technical notes

- Reuse the existing `setInvoicesExcludedBulk` server function in `src/lib/xero/scenario.functions.ts` — no schema or backend change needed.
- In `src/routes/_authenticated/clients.$clientId.cashflow-scenario.tsx`, derive the customer list from `data.invoices` (grouped by `customer_id`), filter the invoice ids by the selected customer and scope, and pass them to the existing bulk mutation.
- Selected customer held in local component state; scope defaults to the current month.
