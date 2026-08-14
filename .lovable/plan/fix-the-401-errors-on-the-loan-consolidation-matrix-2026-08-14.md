# Fix the 401 errors on the Loan Consolidation matrix

## What is going wrong

Every loan row shows `Xero Reports/TrialBalance: 401 Unauthorized`. This is not a broken
connection — the other dashboards using the same Xero files load fine. The app asks Xero
for the **Trial Balance** report, but the permission set the Xero files were connected with
does not include Trial Balance access. Xero replies "Unauthorized" for that one report only.

Current permissions requested at connect time:
Balance Sheet, Bank Summary, Profit & Loss, Tax reports, Invoices, Payments, Settings, Contacts.
Trial Balance is not covered by any of those.

## The fix (no reconnect needed)

Loan accounts are balance-sheet accounts, so the balances we need are already available in
the **Balance Sheet** report we are permitted to read. Switch the loan matrix off Trial
Balance and onto Balance Sheet.

1. Replace the Trial Balance fetch used by the loan reconciliation with a Balance Sheet
   fetch for the selected "Balance as at" date.
2. Map each Balance Sheet line back to the account (by account id, then code, then name)
   so the existing pairing/matching logic keeps working unchanged.
3. Keep the sign convention the matrix already uses (Payable / Receivable direction and
   Net difference), so Balanced / Mismatch statuses stay correct.
4. If a paired account genuinely has no balance-sheet line (e.g. zero movement account),
   show a dash rather than an error.

## Error handling clean-up

Instead of printing the raw Xero JSON error inside every table cell, show a single short
message per file (for example "Couldn't load balances for this file — reconnect required")
with the technical detail available on hover. This keeps the table readable when a file
really is disconnected.

## Optional follow-up (only if you want Trial Balance back)

Trial Balance would require adding the broader `accounting.reports.read` permission and
re-authorising every connected Xero file. Not recommended — it widens access for no extra
data, and the Balance Sheet route gives the same numbers.

## Technical notes

- `src/lib/xero/loan-xero.server.ts` — replace `fetchTrialBalance` with a Balance Sheet
  based balance loader returning the same `byAccountId` / `byAccountCode` / `byAccountName`
  maps, so callers stay unchanged.
- `src/lib/loan-recon.server.ts` — swap the import/call and drop Trial Balance parsing.
- `src/routes/_authenticated/firms.$firmId.loans.index.tsx` — condense per-row error text
  into a single per-file notice.
- No database or permission changes.
