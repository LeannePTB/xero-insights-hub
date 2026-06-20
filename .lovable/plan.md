## Goal

Make "This period (BAS)" return the same numbers as the Xero Activity Statement PDF (Jun 2026: G1 = 21,367 · 1A = 1,942 · 1B = 212 · W5 = 1,795 · Net 9 = 3,525) on Cash Basis.

## Why it's currently $0

`getActivityStatementPeriod` tries `Reports/ActivityStatement` first, and on any non-404 error silently falls through to a fallback computed from `Reports/AccountTransactions`. On this org one or both is failing:

- The Activity Statement call is either being rejected (missing/insufficient scope, or wrong param shape) or returning a report whose row shape `extractBoxes` doesn't recognise — so it's treated as empty.
- The AccountTransactions fallback returns 0s because we throw away per-account errors silently, and on cash basis those reports often come back with no Debit/Credit columns the way the parser expects.

Net result: the UI shows $0 with no signal about which call failed.

## Fix

Replace the silent fallback chain with a single, observable Activity Statement call, plus diagnostics so we can iterate quickly if Xero rejects the shape.

### 1. `src/lib/xero/reports.functions.ts` — rewrite `getActivityStatementPeriod`

- Drop the AccountTransactions fallback entirely. It can't reliably reproduce BAS boxes on cash basis and it's actively misleading when it returns 0.
- Call `Reports/ActivityStatement` once with `fromDate` / `toDate`. The Xero AU endpoint already returns Cash- or Accrual-basis numbers based on the org's GST accounting method (the PDF header confirms this org is "Cash Basis"), so no basis param is needed.
- Catch ALL errors from that call (not just 404) and return a structured `{ source: "unavailable", message }` payload that surfaces the underlying Xero error message to the UI. No more silent 0s.
- When the call succeeds but `extractBoxes` returns no recognised boxes, capture the raw row labels and include them in `message` so we can adjust the parser next pass.
- Harden `extractBoxes`:
  - Recognise codes that appear with a trailing colon or wrapped in parens (e.g. `"1A"`, `"1A:"`, `"(1A)"`).
  - Some Xero reports put the code inside the label cell ("GST on sales 1A") rather than its own cell — scan label text with the same regex as a fallback when no dedicated code cell is found.
  - Strip `$`, currency codes and thousands separators before `Number(...)`.
- Return `gstOnSales` (1A), `gstOnPurchases` (1B), `paygWithheld` (W5 with the existing W2+W3+W4 fallback), `netGst = 1A − 1B`, `netPayment = box 9` (and only fall back to `1A + W5 − 1B` if box 9 is missing), plus `totalSales` (G1) and `boxes` for debugging.

### 2. `src/components/dashboard/TaxLiabilityWidget.tsx`

- Handle the new `source === "unavailable"` case: show the message inside the same dashed note slot we already use for "Estimated…", instead of rendering 4 × $0 tiles.
- Keep the existing 1A / 1B / W5 / Net payment grid for `source === "activity-statement"`.
- Remove the now-unused `"fallback"` branch.

### 3. Default period

When the org is on Cash basis Simpler BAS the PDF is monthly. Default `periodFrom` to the first day of the previous month and `periodTo` to the last day of that month, so the card opens on a complete period that lines up with the most recent BAS, not the current partial month. (User can still override via the date controls.)

## Out of scope

- "Outstanding on balance sheet" section, buckets, reconciliation strip — unchanged.
- No changes to Super / Payables / Receivables / P&L cards.
- No DB / migration changes.

## Verification

After deploy, with FROM = 1 Jun 2026, TO = 30 Jun 2026, the four tiles should read:
- GST on sales (1A): A$1,942
- GST on purchases (1B): A$212
- PAYG withheld (W5): A$1,795
- Net payment (9): A$3,525

If Xero returns something else, the dashed note will now tell us *what* (raw error or unrecognised row labels) instead of silently rendering 0s.
