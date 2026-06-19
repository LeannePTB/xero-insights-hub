## Restructure Accounting Break-Even section

Replace the current 4-tile KPI grid in `src/components/dashboard/BreakevenWidget.tsx` with a vertical 2-column table (Item / Value) matching the screenshot.

### Rows (in order)

1. **Total Fixed Costs** — `fmt(fixedOpex)`
2. **Gross Margin %** — `pct(grossMargin)`
3. **Break-Even Revenue** *(Fixed Costs ÷ Gross Margin %)* — `fmt(breakevenRevenue)` (label shows the formula in italics, matching the screenshot's emphasis)
4. **Monthly Revenue** — `fmt(monthlyIncome)` (average monthly income over the selected period)
5. **Above or Below Break-Even?** — text "Above" (green) or "Below" (red), based on `monthlyIncome >= monthlyBreakeven`
6. **Operating Loss/Profit** — `fmt(income - totalVariable - fixedOpex)`; green if ≥ 0, red if < 0; label flips to "Operating Profit" or "Operating Loss" so the sign reads naturally

### Styling

- Two-column table with subtle row dividers, matching the existing card aesthetic (border, muted header background on the "Item" column like the screenshot's grey label cells).
- Reuse existing `fmt()` / `pct()` helpers.
- Keep the "Period Performance" section above (Revenue / Cost of Sales / Gross Profit Margin) unchanged.
- Keep the expandable calculation breakdown, monthly progress bar, unclassified-accounts banner, and footer text below — unchanged.
- Remove the old 4-tile grid (Fixed Costs / Break-Even Revenue / Break-Even per mo / Surplus or Shortfall per mo) since the new table replaces it.

### Files

- Edit only `src/components/dashboard/BreakevenWidget.tsx`.
