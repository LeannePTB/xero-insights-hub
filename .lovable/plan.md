# Fix Tax & Super liabilities to match the BAS

The widget currently diffs Balance Sheet GST/PAYG balances on accrual basis, which won't match a cash-basis Activity Statement (Positive Traction's BAS shows 1A $2,207, 1B $5,050, W2 $3,056, net $213 for May 2026). Switch to Xero's official Activity Statement report so the numbers match the PDF exactly, and keep Super as a separate line sourced from the Balance Sheet.

## Changes

### 1. `src/lib/xero/reports.functions.ts`
- Add `getActivityStatement` server fn (`Reports/GSTReport` for AU orgs, with `fromDate`/`toDate`). Parse the Xero report to extract the BAS boxes by row label/code:
  - G1 (Total sales), 1A (GST on sales), 1B (GST on purchases), W1, W2, W4, W3, W5, 8A, 8B, line 9 (net payable/refund).
  - Return `{ periodFrom, periodTo, basis: 'cash'|'accrual', gstOnSales, gstOnPurchases, netGst, paygWithheld, totalOwed, totalRefund, netPayment, lines: [...] }`.
- Keep existing `getTaxLiabilities` for backward compatibility but mark deprecated.
- Add `getSuperPayable` server fn that reads Balance Sheet super accounts only (reuse `classifyTaxLine` 'super' branch) for the as-at date, returning `{ balance, lines, asAtDate }`.

### 2. `src/components/dashboard/TaxLiabilityWidget.tsx`
- Replace the single fetch with two queries: `getActivityStatement` (period range) + `getSuperPayable` (as-at end of period).
- Period selector stays: Current month / Last month / Last quarter. Period is always passed as fromDate/toDate — Xero returns the matching Activity Statement (monthly or quarterly depending on the org's BAS frequency; we just pass the range we want).
- Remove the balance/movement toggle (Activity Statement is always a period report). Keep a small note showing the basis Xero reports ("Cash basis" / "Accrual basis").
- KPI tiles:
  - GST on sales (1A)
  - GST on purchases (1B)
  - Net GST (1A − 1B, labelled "payable" or "refund")
  - PAYG Withheld (W2)
  - Super payable (from Balance Sheet, as-at end of period)
  - Net BAS payment (line 9)
- Breakdown list: BAS line items with codes (G1, 1A, 1B, W1, W2, W5, 8A, 8B, 9), plus Super lines underneath in a separate section.

### 3. Access control
- Reuse `assertWidgetAccess(userId, tenantId, "tax_liability")` for both new server fns. No schema/migration changes.

### 4. Edge cases
- Non-AU orgs / orgs without an Activity Statement → catch Xero 404 and surface a friendly message "Activity Statement not available for this organisation" instead of erroring.
- If Xero returns no row for a code (e.g. no PAYG that month), show 0 and keep the line.
- Cache the report in `report_cache` keyed by `(tenantId, fromDate, toDate, 'activity_statement')` for ~10 min like other reports (if that pattern is already used; otherwise skip).

## Verification
1. Open the Positive Traction dashboard, pick "Last month" → confirm 1A=$2,207, 1B=$5,050, W2=$3,056, net=$213, matching the uploaded PDF.
2. Pick "Last quarter" → confirm it matches the quarterly Activity Statement in Xero.
3. Pick an org without AU GST → confirm the friendly fallback message renders instead of an error.
