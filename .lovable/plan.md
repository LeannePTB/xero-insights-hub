## Why the numbers don't match

The current "This period (BAS)" fallback compares the **Balance Sheet** of GST/PAYG liability accounts at the start vs end of the period. That measures *net change in the liability*, which includes BAS **payments** made during the period — so paying last quarter's BAS makes this period's "Net GST" look negative, which is exactly what the screenshot shows (Net GST −$291, PAYG −$666).

The Xero PDF (1A=$1,942, 1B=$212, W5=$1,795, Net=$3,525) is a sum of *transactions posted to those accounts during the period*, not the balance change.

## Fix

Replace the fallback in `getActivityStatementPeriod` to compute period figures from the **Profit and Loss / Account Transactions** activity on each GST and PAYG account, not the balance-sheet delta.

### Approach

For each GST and PAYG account discovered on the Balance Sheet, call `Reports/ProfitAndLoss` won't work (these are liabilities). Instead use:

- `Reports/BankSummary` — no.
- **`Reports/ExecutiveSummary`** — too aggregated.
- **`Reports/TrialBalance` with `date=toDate` and `paymentsOnly` toggle** — only gives balance, not period movement.
- **`Reports/AccountTransactions?AccountID=<id>&fromDate&toDate`** — gives every line for the account in the window, with separate Debit/Credit columns. **This is the correct endpoint.**

Steps in the fallback handler:

1. Fetch the Balance Sheet as at `toDate` once to discover GST and PAYG account names + IDs (re-use `extractTaxLines`, extend it to also surface `accountId` from `RowID`/`Attributes`).
2. For each GST account, call `Reports/AccountTransactions` for `[fromDate, toDate]`. Sum:
   - **Credits** → adds to **1A (GST on sales)**
   - **Debits** → adds to **1B (GST on purchases)**
3. For each PAYG Withholding account, call `Reports/AccountTransactions` and sum **Credits** → **W5 (PAYG withheld)**. (Debits there are BAS payments and shouldn't reduce W5.)
4. Compute `netGst = 1A − 1B`, `netPayment = netGst + W5`.
5. Keep the "Estimated …" message but update wording to: *"Estimated from GST/PAYG account transactions for the period."*
6. Exclude lines whose source is `BAS Payment`/`Manual Journal` only if needed — first pass: include everything posted to the account, which matches what Xero's Simpler BAS worksheet does.

### Sign handling

Liability accounts: credits are positive (increase liability = tax collected). Xero's `AccountTransactions` report returns numeric `Debit` and `Credit` columns per row. Use absolute values from those columns rather than the signed `NetAmount`, so the result is independent of how Xero presents the running balance.

### Files

- `src/lib/xero/reports.functions.ts`
  - Extend `extractTaxLines` (or add a parallel helper) to capture `accountId` for GST/PAYG rows.
  - Rewrite the fallback branch (lines ~417-456) of `getActivityStatementPeriod` per above.
  - Populate `gstOnSales` (1A) and `gstOnPurchases` (1B) in the fallback return so the UI can show the same four tiles as the Activity Statement path.
- `src/components/dashboard/TaxLiabilityWidget.tsx`
  - Show **1A, 1B, W5, Net payment** tiles for both `source === "activity-statement"` and `source === "fallback"` (drop the special "Net GST" single tile in fallback now that 1A/1B are real).

### Out of scope

- No changes to the "Outstanding on balance sheet" section, buckets, or super/payables/receivables widgets.
- No DB or migration changes.

### Verification

After the change, with FROM=1 Apr 2026 TO=30 Jun 2026 (the quarter on the user's PDF), the four tiles should match 1A=$1,942, 1B=$212, W5=$1,795, Net=$3,525 within rounding. The 1–20 Jun window the user is currently viewing will naturally be smaller (partial period), which is expected.
