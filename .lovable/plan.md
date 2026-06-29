
# Business Health — Pillar Breakdown (no Customers)

Expand the existing compact `HealthWidget` with a detailed pillar grid underneath. The Customers pillar from the reference screenshot is dropped entirely — Xero has no CRM data and there's no plan to integrate one.

## Pillars (4 cards in a responsive grid)

1. **Money — Are you profitable?**
   - Revenue growing? (vs prior FY)
   - Gross margin % (band: Poor / OK / Good / Great)
   - Net margin %
   - Cash in bank (Very low / Low / Healthy / Strong vs monthly opex)
   - Debt carried (from BS liabilities)
   - CTA: "Why is cash so low?"

2. **Efficiency — Is the team productive?**
   - Operating profit %
   - Wages as % of revenue (sum of Wages / Salaries / Super accounts ÷ revenue)
   - Bad debts as % of revenue
   - Bills paid on time (% current vs overdue from AP ageing)
   - CTA: "Improve efficiency"

3. **Growth — Is the pipeline full?**
   - Revenue single source (top contact share of invoices)
   - Monthly rev trend (last 3 months vs prior 3, "No comparison" when missing)
   - New customers / Pipeline leads → **Not in Xero** (amber pill, no CRM)
   - CTA: "Diversification risk"

4. **Stability — Could you weather a storm?**
   - Months of runway (cash ÷ avg monthly opex)
   - Revenue concentration (top customer % of revenue)
   - Debts owed to business (AR total)
   - Amount business owes (AP total)
   - CTA: "What to do now"

Each card: title + subtitle, score 0–100 with colored bar (green ≥80, amber 60–79, red <60, gray `—/100` when insufficient data), metric rows with right-aligned colored pills, single outline CTA.

## Data

Extend `src/lib/health.functions.ts` with `getBusinessHealthDetail({ tenantId })` — one round-trip returning all pillar data:

- P&L current FY + prior FY (`Reports/ProfitAndLoss`, timeframe=MONTH, periods=12) — Money, Efficiency, Growth trend
- Balance Sheet (already used) — Cash, debt carried
- `Reports/AgedReceivablesByContact` + `AgedPayablesByContact` — Stability AR/AP, bills-paid-on-time
- `Invoices` for FY grouped by ContactID — single-source / concentration
- Walk P&L expense rows by account name for wages/salary/super classification

## UI files

- New: `src/components/dashboard/health/PillarCard.tsx` (reusable card shell)
- New: `src/components/dashboard/health/StatusPill.tsx` (green/amber/red/not-in-xero)
- New: `src/components/dashboard/HealthDetail.tsx` (grid wrapper, fetches detail)
- Extend: `src/lib/health.functions.ts` with `getBusinessHealthDetail`
- Update: `src/routes/_authenticated/clients.$clientId.index.tsx` to render `<HealthDetail>` directly under `<HealthWidget>`

## Out of scope

- Customers pillar (removed per request)
- Real action drawers behind CTAs — CTAs route to existing widgets (Cashflow, Payables) or open a brief explainer
- Changes to the existing compact `HealthWidget` overview — it stays as the headline
