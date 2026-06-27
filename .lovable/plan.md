## Why "This period (BAS)" is failing

The widget calls `Reports/ActivityStatement`. Xero restricts that endpoint to **approved AU partner apps** — even with `accounting.reports.read`, regular OAuth apps get 403 / NotFound. It is not a missing scope we can add; Xero requires partner certification. That's why the section stays empty.

## Fix: derive the current-period BAS figures from GL movement

For a pre-lodgement view, the accrued GST / PAYG for a period equals the **movement in the relevant liability accounts** between the day before `fromDate` and `toDate`. We already pull `Reports/BalanceSheet` on both bases, so no new scope or reconnect is needed.

### Changes

1. **`src/lib/xero/reports.functions.ts` — `getActivityStatementPeriod`**
   - Keep trying `Reports/ActivityStatement` first; if it returns data, use it (so partner-approved orgs still get the Xero-native numbers).
   - Otherwise pull `Reports/BalanceSheet` at `toDate` and at `fromDate − 1 day`, honouring the selected basis (`paymentsOnly=true` for cash), and reuse `extractTaxLines` to find GST / PAYG accounts.
   - Compute period movement per account:
     - GST accounts whose name matches `collected|output|on sales|on income` → `gstOnSales` (1A).
     - GST accounts whose name matches `paid|input|on purchases|on expenses|claimable` → `gstOnPurchases` (1B).
     - GST accounts that are a single net account → surface as `gstOnSales`, leave `gstOnPurchases = 0`.
     - PAYG accounts → `paygWithheld` (W5).
   - Return `source: "balance-sheet-movement"` with a message: *"Calculated from balance-sheet movement on GST and PAYG accounts. Final BAS figures are confirmed at lodgement."*
   - Extend the `ActivityStatementPeriod['source']` union to include `"balance-sheet-movement"`.

2. **`src/components/dashboard/TaxLiabilityWidget.tsx` — `PeriodSection`**
   - Widen the `source` prop type to accept `"balance-sheet-movement"`.
   - Render the KPIs for both `activity-statement` and `balance-sheet-movement` sources.
   - Show a small caption under the section header indicating the source (e.g. *"Source: GL movement"* vs *"Source: Xero Activity Statement"*).

3. **No schema, scope, or reconnect changes.** Existing `accounting.reports.read` is sufficient.

### Out of scope
- Pursuing Xero partner certification for `Reports/ActivityStatement`.
- Changes to the Superannuation widget or the outstanding-buckets section.
