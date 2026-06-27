## Cash Flow widget

A new dashboard widget showing actual bank movement (Money In / Money Out / Net) over the selected date range, with current cash position and a simple 30/60/90-day forward projection driven by AR and AP due dates.

### What I already have
I don't need anything from you to build this — Xero exposes everything via your existing connection:
- Bank balances and bank transactions (`Accounts` where `Type=BANK`, `BankTransactions`).
- Receivables and Payables due-date data (already powering the AR/AP widgets).

The only thing worth confirming is below.

### What it will show

**Top row — current position**
- Total cash across all bank accounts (today)
- Per-bank-account balances (expandable)
- Basis badge: Cash (bank data is inherently cash-based; locked, not switchable)

**Middle — actuals for the selected date range** (uses the shared `DateRangeControls`)
- Money In, Money Out, Net movement
- Period-over-period delta vs prior equal-length period (same style as P&L tiles)
- Expandable monthly breakdown table

**Bottom — 90-day forward projection**
- Opening cash (today's balance)
- Expected inflows: outstanding AR grouped by due bucket (next 30 / 31–60 / 61–90 days), overdue treated as "next 30"
- Expected outflows: outstanding AP grouped the same way
- Projected closing cash at +30, +60, +90 days
- Coloured red when any bucket projects negative
- Small disclaimer: "Projection based on AR/AP due dates; excludes recurring expenses and one-off items not yet invoiced."

### Technical details

1. **`src/lib/xero/cashflow.functions.ts`** — new `getCashflow` server fn (auth-protected, `requireSupabaseAuth`), keyed off `(tenantId, from, to)`:
   - `GET /Accounts?where=Type=="BANK"` for balances
   - `GET /Reports/BankSummary?fromDate&toDate` for per-period in/out/net (single Xero call, already aggregated)
   - Reuses existing AR/AP report fetchers for due-bucket projection
   - Cached via `report_cache` like the other widgets

2. **`src/components/dashboard/CashflowWidget.tsx`** — same layout language as `PnlWidget` / `PeriodPerformanceWidget`; uses `DateRangeControls`, `BasisBadge` (fixed to "Cash"), shared `tabular-nums` alignment, and a `<details>` block for the per-account / per-month breakdowns.

3. **Widget registry** (`src/lib/tiers.ts`):
   - Add `"cashflow"` to `WidgetKey`, `ALL_WIDGETS`, `WIDGET_LABEL` ("Cash Flow")
   - Add to `advisory`, `investigate`, `multi_company` default tier lists (not `basic`)

4. **Dashboard composition** (`src/routes/_authenticated/clients.$clientId.index.tsx`):
   - Render `<CashflowWidget />` in the Advisory section when `widgets.includes("cashflow")`
   - Add to `DEFAULT_ON` so basis override UI is hidden (basis is locked)

5. **Tier widget admin UI** — picks up the new key automatically via `ALL_WIDGETS`; no extra code.

6. **DB migration** — none required. Uses existing `report_cache`, `tier_widget_config`, etc.

### One quick check before I build

Are you happy with the forward projection using **only AR and AP due dates** for v1? That's accurate but conservative — it won't show recurring expenses (wages, rent, subs) that aren't yet entered as bills in Xero, so the projected outflow side can look light. If you'd rather, I can layer in a "recurring expense average" using the trailing 3-month bank outflow average net of AP-driven outflows to fill the gap. Happy to start with AR/AP only and add that later if you want it tighter.
