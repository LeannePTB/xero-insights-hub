## Replace Growth pillar with Cash Flow & Liquidity

Drop the Growth pillar from Business Health (it relied on CRM/pipeline data Xero doesn't hold) and replace it with a Cash Flow & Liquidity pillar built entirely from Xero data we already pull.

### New pillar: Cash Flow & Liquidity

Subtitle: "Is cash actually moving the right way?"

Metrics (4):
1. **Net cash movement (period)** — change in bank balance over the selected range. Status: good if positive, watch if flat (±5% of monthly opex), bad if negative.
2. **Working capital** — Current Assets − Current Liabilities from the balance sheet. Status: good if > 1× monthly opex, watch if positive but < 1×, bad if negative.
3. **Days Sales Outstanding (DSO)** — (AR ÷ revenue) × period days. Status: good ≤ 30, watch 30–60, bad > 60.
4. **Quick ratio** — (Cash + AR) ÷ Current Liabilities. Status: good ≥ 1.0, watch 0.7–1.0, bad < 0.7.

Score weighting inside the pillar: net cash movement 30%, working capital 30%, DSO 20%, quick ratio 20%.

### Wiring

- Update `getBusinessHealthDetail` in `src/lib/health.functions.ts`:
  - Remove the `growth` pillar block and its metrics (revenue concentration moves stays only in Stability where it already lives; `New customers` / `Pipeline leads` "Not in Xero" rows are dropped).
  - Add a `cash_flow` pillar block using existing bank balance, balance sheet, AR ageing, and P&L data already loaded in this function — no new Xero calls.
  - Pillar key: `"cash_flow"`, title `"Cash Flow"`, CTA label `"How to free up cash"`.
- Update the `PillarMetric` key union and pillar key union to swap `growth` → `cash_flow`.
- Rebalance the overall Business Health score weighting in `src/lib/health.functions.ts` (currently Money 40 / Efficiency 30 / Stability 30 with Growth unused in headline). Keep the headline formula unchanged; the new pillar appears only in the detail grid.

### Recommendations + CTA

- Add `getCashFlowRecommendations` to `src/lib/health.recommendations.ts` with rules per metric:
  - Negative net cash movement → tighten terms, defer capex, weekly cash flow forecast.
  - Negative working capital → urgent: restructure short-term debt, push out payables, accelerate receivables.
  - High DSO → automate dunning, deposits up-front, stop work at 30 days overdue.
  - Low quick ratio → build cash buffer, convert idle stock, renegotiate supplier terms.
- New component `src/components/dashboard/CashFlowRecommendations.tsx` mirroring `StabilityRecommendations.tsx`.
- Wire it into `src/components/dashboard/HealthPillars.tsx` so the Cash Flow CTA expands inline like Money/Efficiency/Stability.

### UI

- Grid stays at 4 pillars: Money, Efficiency, Cash Flow, Stability.
- No layout, color, or component-shape changes — only the swapped pillar content.

### Out of scope

- No new Xero API calls or scopes.
- No changes to the headline Business Health score, donut, or date picker.
- No migration — all derived in the server function.
