# Add "Current balance" toggle to Tax & Super widget

Add a view toggle next to the period selector so users can switch between:
- **Activity Statement** — current behaviour: BAS boxes (1A, 1B, W2, etc.) for the selected period, pulled from Xero's Activity Statement report.
- **Current balance** — live balances of GST Payable, PAYG Withholding Payable, and Super Payable accounts from the Balance Sheet, as at today.

## Changes

### 1. `src/lib/xero/reports.functions.ts`
Add `getCurrentTaxBalance` server fn:
- Input: `{ tenantId: string; date?: string }` (defaults to today).
- Calls `Reports/BalanceSheet` for `date`.
- Reuses existing `extractTaxLines` to classify rows as `gst | payg | super | other-tax`.
- Returns `{ asAtDate, gst, payg, superannuation, otherTax, total, lines }` where each line keeps name + amount + category.
- Reuses `assertWidgetAccess(..., "tax_liability")`.

### 2. `src/components/dashboard/TaxLiabilityWidget.tsx`
- Add a `view: "bas" | "balance"` state with a small toggle (Select or two-button group) next to the period selector.
- When `view === "balance"`:
  - Hide the period selector (balance is always as-at today; allow MTD/EOM later if needed).
  - Fetch `getCurrentTaxBalance` with today's date.
  - Show KPI tiles: GST Payable, PAYG Withholding, Super Payable, Total.
  - Show a breakdown list grouped by category (GST / PAYG / Super / Other tax) with account name and balance.
  - Subtitle: "Live balance as at {today}".
- When `view === "bas"`: keep the existing Activity Statement behaviour exactly as it is.
- Refresh button refetches whichever query is active.

### 3. No DB / migration changes.

## Verification
1. Open Positive Traction dashboard → default view = Activity Statement (unchanged).
2. Flip toggle to "Current balance" → shows GST Payable / PAYG / Super balances from the Balance Sheet as-at today.
3. Flip back → Activity Statement reappears with last-month figures matching the BAS PDF.
