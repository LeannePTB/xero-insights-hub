## Goal
Stop showing the GL-movement BAS estimate as if it can replace Xero’s Activity Statement. The card should be honest: exact BAS figures require Xero partner-certified access to the Activity Statement report.

## Plan
1. **Remove the GL movement fallback from “This period (BAS)”**
   - Keep the direct Xero Activity Statement call.
   - If Xero rejects or hides that report, show a clear unavailable state instead of calculated BAS figures.
   - Remove the “Source: GL movement” path and the balance-sheet-movement message.

2. **Keep the useful balance-sheet section**
   - Leave “Outstanding on balance sheet” in place so you can still see current GST/PAYG liabilities from the balance sheet.
   - Keep the balance-sheet reconciliation/breakdown, because that is still available without Activity Statement certification.

3. **Add a certification-ready message**
   - Show wording like: “Exact BAS figures require Xero Activity Statement access. This app needs Xero partner certification before this period can load.”
   - Avoid implying the dashboard can calculate the final BAS before lodgement from general ledger movements.

4. **After certification**
   - The existing Activity Statement integration can remain as the primary path.
   - Once Xero grants access, the same widget should start using the official Activity Statement response for 1A, 1B, W5, and 9.

## Technical notes
- Update `getActivityStatementPeriod` so its only successful source is `activity-statement`.
- Update `TaxLiabilityWidget` types and UI to remove `balance-sheet-movement` as a displayed source.
- Do not change dashboard layout, tiers, or other widgets.