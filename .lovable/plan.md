## Goal

Re-expose a per-client **Report basis** control (Accrual / Cash) at the client dashboard level, persist it on `clients.report_basis` (already in DB), and have specific cards consume it while the rest stay on Accrual.

## Why

The backend already supports it (`clients.report_basis` column, `getClientReportBasis()`, `updateClientReportBasis` server fn, `BasisSelect` component). It just isn't wired into the UI on the client dashboard, so Tax Liabilities always shows the DB default (`accrual`) and never reflects that this client is on Cash.

## Changes

### 1. `src/routes/_authenticated/clients.$clientId.index.tsx`
- Replace the static "All dashboards report on an Accrual basis…" line with a **Report basis** selector in the client header.
  - Uses `BasisSelect` bound to `client.report_basis` from the existing loader data.
  - On change → calls `updateClientReportBasis({ clientId, basis })`, then `router.invalidate()` so dashboards refetch.
  - Advisors only (viewers see a read-only badge — same visual style).
- Add a small helper line: "Used by Tax Liabilities and P&L. Other cards report on Accrual."

### 2. `src/components/dashboard/TaxLiabilityWidget.tsx`
- No data-flow change needed (it already calls `getTaxLiabilityBuckets` which reads `getClientReportBasis`), but the badge will now correctly show "CASH" once the client is set to Cash.
- Confirm the `useQuery` key includes a basis-bumping signal: bump the query key with the client's `report_basis` (passed in as a prop) so changing the selector invalidates the cached result immediately.

### 3. Card defaulting policy
- **Uses client basis**: P&L (already does), Tax Liabilities (already does via server).
- **Forced Accrual** (no change): Receivables, Payables, Superannuation, Breakeven, Unreconciled, Cost Classification, True Breakeven.
- After this plan ships, you tell me which other cards should follow the client basis and I'll flip them one by one.

## Out of scope

- No DB migration (column already exists, default `accrual`).
- No change to the underlying bucket math.
- No per-card basis override UI — single client-level setting only.

## Acceptance

- On a client whose `report_basis` is `cash`, the Tax Liabilities badge reads **CASH** and the Balance Sheet numbers come back in cash basis.
- Switching the selector to Accrual and back updates the badge and refetches the report without a page reload.
- Viewers can see the current basis but can't change it.
