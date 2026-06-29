
## Business Health widget (compact overview)

Replace the current placeholder `HealthWidget.tsx` with a real, compact overview that shows a single composite score, a one-line verdict, a small KPI strip, and one priority alert. No customers section, no per-pillar cards, no "what to do now" CTAs — those can come later.

### Layout (single card, fits in the existing top-of-dashboard slot)

```text
┌─────────────────────────────────────────────────────────────────────┐
│ {Client} · {CCY} · FY{YY}–{YY} to date                              │
│                                                                     │
│  (donut 64)   Needs some work                                       │
│   64 /100     Strong profitability but cash is very tight…          │
│               🔄 Live from Xero · 29 Jun 2026                       │
│                                                                     │
│  Revenue   Gross margin   Net profit   Cash in bank   Owed to you   │
│  $325,426  46.3%          $54,862      $2,339         $94,123       │
│                                                                     │
│  ⚠ Priority alert — bad debts                                       │
│  $47,462 in bad debts is 14.6% of revenue…                          │
└─────────────────────────────────────────────────────────────────────┘
```

Smaller than the screenshots: one row of KPI tiles (wraps on mobile), no per-pillar grid, no buttons. Bad debts only surfaces in the alert strip, not as a duplicate tile.

### Data (FY-to-date, accrual)

Pull once per tenant via a new server fn `getBusinessHealth({ tenantId })`:
- `Reports/ProfitAndLoss` FY-to-date → Revenue, COGS → Gross profit & margin, Net profit & margin.
- `Reports/BalanceSheet` as of today → Cash in bank (sum of bank-class accounts), Bad debts (Doubtful debts / Allowance for doubtful debts account if present, else 0).
- `Reports/AgedReceivablesByContact` summary total → Owed to you.
- Reuse `useTenantCurrency` for formatting.

### Score (0–100, three sub-scores, no "customers")

Composite = weighted average of:
- **Money** (40%): net margin band + gross margin band.
- **Efficiency** (30%): operating profit %, bad debts as % of revenue (penalty), AP-on-time proxy from aged payables 0-day bucket.
- **Stability** (30%): months of runway (cash ÷ avg monthly opex), AR concentration penalty if `aged_receivables > 0.5 × revenue_monthly_avg`.

Band → label:
- 80–100 "Strong"
- 60–79 "Needs some work"
- 0–59 "Urgent attention"

Color the donut + label via existing semantic tokens (`text-primary`, `text-destructive`, amber via `text-amber-600` already used in the reconnect banner).

### Priority alert

Pick the single worst signal by normalized severity (bad debts %, runway months, net margin). Render only one. If everything is green, render a positive "All key signals healthy" line instead of the alert box.

### Files

- New: `src/lib/health.functions.ts` — `getBusinessHealth` server fn (auth middleware, accrual, FY-to-date).
- New: `src/components/dashboard/HealthScoreDonut.tsx` — small SVG donut (no chart lib).
- Rewrite: `src/components/dashboard/HealthWidget.tsx` — props `{ tenantId, tenantName, clientName }`, uses `useQuery` + `useTenantCurrency`, renders the layout above with `Skeleton` while loading and a soft error fallback if the call fails.
- Update: `src/routes/_authenticated/clients.$clientId.index.tsx` — pass `tenantId` / `tenantName` / `client.name` to `<HealthWidget>` (currently rendered with no props). Keeps the same position above the Notes / Uncoded grid.

### Out of scope (can add later as separate plans)

Per-pillar drilldown cards, Growth/Customers pillars, "Why is cash so low?" explainers, historical trend, configurable weights.
