## Goal

Tax card should show, side-by-side:
1. **This period BAS** — 1A, 1B, W5, line 9 from the Xero Activity Statement (matches the PDF exactly).
2. **Outstanding on balance sheet** — existing buckets (Not yet due / Due / Overdue) + BS breakdown.

Also fix the "Activity Statement isn't available" path so Simpler BAS orgs (which the PDF confirms exists) still get period figures by falling back to GST/PAYG account movements when the AS endpoint 404s.

## Why current numbers don't match

- BAS endpoint returned 404 → no lodged amounts → buckets default to "Not yet due", and overdue can't be computed.
- PAYG BS balance $5,924 includes accumulated unpaid PAYG from earlier periods; June BAS only owes $1,795.
- GST BS balance −$475 (debit) reflects net of GST on sales/purchases not yet journaled to a BAS clearing account.

## Changes

### `src/lib/xero/reports.functions.ts`

- New server fn `getActivityStatementOrFallback({ tenantId, fromDate, toDate })`:
  - Try `Reports/ActivityStatement` first (existing logic).
  - If unavailable, compute fallback from `Reports/ProfitAndLoss` (cash basis) GST account movement + Payroll Activity Summary for PAYG W5. Return `{ source: "activity-statement" | "fallback", boxes: { "1A","1B","W5","9","G1" }, periodFrom, periodTo, basis }`.
  - For the fallback, label clearly so the UI can say "Estimated from GST/Payroll accounts".
- Keep `getTaxLiabilityBuckets` unchanged (still BS snapshot).

### `src/components/dashboard/TaxLiabilityWidget.tsx`

- Add a date-range picker (period start / period end) defaulting to the current month, separate from the existing "As at" date.
- Add a second `useQuery` calling the new period fn.
- Render two stacked sections inside the card:
  - **This period (BAS)**: KPI tiles for 1A, 1B, W5, and a prominent "Net payment (9)". Show period and basis. If `source === "fallback"`, show a small italic note: "Estimated — Activity Statement endpoint not available for this org."
  - **Outstanding (balance sheet)** (existing): As-at date, bucket KPIs, reconciliation strip, BS breakdown list. Keep the existing `asMessage` notice.
- Keep `BasisBadge`/reporting basis behaviour unchanged.

### Out of scope

- No DB migration.
- No change to Superannuation, Payables, Receivables, or other widgets.
- No change to `getTaxLiabilityBuckets` math beyond what's needed to coexist.

## Technical notes

- AU Activity Statement endpoint returns 404 for orgs on Simpler BAS / non-GST-worksheet — fallback path required.
- Fallback PAYG via `Reports/PayrollActivitySummary` if available; otherwise show "—" with a tooltip instead of guessing.
- Cash basis: pass `paymentsOnly: "true"` to P&L when `basis === "cash"` for the GST fallback.
