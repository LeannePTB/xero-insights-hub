
## Restructure Breakeven widget display

Reorganise the KPI grid in `src/components/dashboard/BreakevenWidget.tsx` into two labelled sections. No calculation changes — just layout, labels, and grouping.

### Section 1 — Period Performance
Row of three KPIs (period totals over the selected date range):
- **Revenue** — `income`
- **Cost of Sales (Variable)** — `totalVariable` (CoGS + any opex tagged Variable)
- **Gross Profit Margin** — `pct(grossMargin)`

### Section 2 — Accounting Break-Even
Row of KPIs:
- **Fixed Costs** — `fixedOpex` (period total)
- **Break-Even Revenue** — `breakevenRevenue` (Fixed Costs ÷ Gross Margin %, for the period)
- **Break-Even / month** — `monthlyBreakeven`
- **Surplus / Shortfall / mo** — keep existing surplus tile here

### What's removed / changed
- Drop the standalone "Operating Expenses", "Fixed Costs / mo", "Variable Costs / mo" tiles from the top grid (they were redundant with the new grouping).
- Keep everything else as-is: date controls, unclassified warning, excluded-accounts footnote, monthly progress bar, and the explanatory footer.

### Section headings
Small uppercase muted labels above each grid, matching existing typography (e.g. `text-xs font-semibold uppercase tracking-wider text-muted-foreground`).

### Files touched
- `src/components/dashboard/BreakevenWidget.tsx` only.
