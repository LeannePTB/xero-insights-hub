
## Goal

Upgrade the **Tax liabilities** card so it shows:

1. **Not yet due** — accruing in the current (open) BAS/IAS period
2. **Due now** — lodged or closed-period amounts still on the balance sheet, within their lodgement window
3. **Overdue** — past-due unpaid amounts derived from lodged Activity Statement history
4. **Basis badge** — read-only "Cash" / "Accrual" pill matching the org's Xero reporting basis
5. **Balance sheet reconciliation row** — raw balance sheet total per tax account so the user can confirm buckets sum back to the balance sheet

## UI changes (`src/components/dashboard/TaxLiabilityWidget.tsx`)

- Add a small badge next to the title: `Cash` or `Accrual` (muted pill, matches existing uppercase-tracked style).
- Replace the current 3 KPIs (GST / PAYG / Total) with a 3-up bucket row:
  - **Not yet due** (current open period accrual)
  - **Due now** (lodged/closed, within lodgement window)
  - **Overdue** (past lodgement due date, unpaid) — red emphasis when > 0
- **Reconciliation strip** below the buckets:
  - `Buckets total: A$X` · `Balance sheet: A$Y` · `Difference: A$Z`
  - Green check when difference is 0; amber warning when it isn't (e.g. manual journals, payments mid-period).
- Per-account breakdown list now shows three columns per row:
  `Account name | Balance sheet amount | Bucket tag (Not due / Due / Overdue)`
- Keep `As at` date picker and refresh button.

## Server changes (`src/lib/xero/reports.functions.ts`)

Add a new server function `getTaxLiabilityBuckets({ tenantId, date })` that:

1. Pulls the current Balance Sheet snapshot (existing `extractTaxLines` logic) — keeps per-account `balanceSheetAmount`.
2. Pulls Activity Statement history via `Reports/ActivityStatement` for the last ~4 periods (graceful fallback for non-AU orgs).
3. For each lodged AS period, computes the **lodgement due date** (28 days after period end for GST/PAYG quarterly; 21 days for monthly IAS) and the lodged net amount (`1A − 1B + W5`).
4. Buckets per account:
   - `overdue` = lodged amounts whose due date < today and still appear unpaid on BS
   - `dueNow` = lodged amounts whose due date ≥ today (within current lodgement window)
   - `notYetDue` = remainder of BS balance attributable to the current open period
5. Returns the org's reporting basis (via `getClientReportBasis`) for the badge.
6. Returns both the bucket totals **and** the raw balance sheet total + per-line BS amounts so the UI can render the reconciliation strip.

Shape:

```ts
type TaxLiabilityBuckets = {
  asAtDate: string;
  basis: "cash" | "accrual";
  notYetDue: number;
  dueNow: number;
  overdue: number;
  balanceSheetTotal: number;   // sum of all tax lines straight off BS
  bucketTotal: number;         // notYetDue + dueNow + overdue
  difference: number;          // balanceSheetTotal - bucketTotal
  lines: {
    name: string;
    category: "gst" | "payg" | "super" | "other-tax";
    balanceSheetAmount: number;
    bucket: "not-due" | "due" | "overdue";
  }[];
  asUnavailable?: boolean; // non-AU: everything falls into notYetDue, difference = 0
};
```

When Activity Statement is unavailable, the full BS balance shows as **Not yet due**, reconciliation strip still renders (difference = 0), and a small note explains overdue can't be computed.

## Scope notes

- Super stays in the separate Superannuation widget.
- No DB schema changes; no new secrets.
- `getCurrentTaxBalance` kept for backward compatibility; widget switches to the new function.
