## Goal

Render the 4 pillar cards (Money, Efficiency, Growth, Stability) under the Business Health overview, and wire the Money pillar's "Why is cash so low?" CTA to inline-expand with rules-based recommendations derived from the metrics. Other pillars render their CTA buttons but stay non-interactive for now.

## Changes

### 1. `src/lib/health.functions.ts`
- Extend `PillarMetric` with an optional `key: string` (stable id like `revenue_growth`, `gross_margin`, `net_margin`, `cash_runway`, `debt_carried`) so the recommendations engine can match by metric, not label text.
- Add `key` to every Money metric (other pillars get keys later — not in scope now).
- Add a new exported pure function `getMoneyRecommendations(metrics: PillarMetric[]): Recommendation[]` (no server call) returning a rules-based list. Shape:
  ```ts
  type Recommendation = {
    title: string;        // "Cash buffer is critically low"
    why: string;          // one sentence reading the metric
    actions: string[];    // 3–5 concrete steps
    severity: "danger" | "watch" | "info";
  }
  ```
- Rules (only emit when the metric is `bad`/`watch`):
  - **cash_runway = bad** → "Cash buffer critically low": pause discretionary spend, chase aged receivables >30d, negotiate supplier terms, review owner drawings, set min cash floor.
  - **cash_runway = watch** → "Cash buffer thin": same actions, lighter framing.
  - **net_margin = bad (loss)** → "Operating at a loss": price review, drop loss-making lines, cut fixed overhead, lift gross margin first.
  - **net_margin = watch (thin)** → "Net margin thin": revisit pricing, audit subscriptions, batch admin.
  - **gross_margin = bad** → "Gross margin under 30%": rate card review, supplier renegotiation, productise services, cost-of-sales audit.
  - **revenue_growth = bad (declining)** → "Revenue is shrinking YoY": reactivate dormant clients, run a price increase on top tier, focus on highest-margin offer.
  - **debt_carried = bad** → "Debt load is heavy vs revenue": consolidate, prioritise highest-rate debt, model interest coverage.
  - If nothing fires, return a single `info` "Money is in good shape" with maintenance suggestions (build 3-month buffer, quarterly margin review).

### 2. New `src/components/dashboard/MoneyRecommendations.tsx`
- Props: `metrics: PillarMetric[]`.
- Calls `getMoneyRecommendations` (sync, client-safe — recommendations live in the same module but the pure function has no Supabase imports).
- Renders a list of recommendation cards: severity-coloured left border, title, "why" line, bulleted actions.

### 3. New `src/components/dashboard/PillarCard.tsx`
- Props: `pillar: Pillar`, optional `expandable?: boolean`, optional `renderExpanded?: () => ReactNode`.
- Layout matches the reference screenshot: title + subtitle, big score `/100`, coloured progress bar, metric rows (label left, status pill right with `good/watch/bad/neutral/not_in_xero` colours), CTA button at bottom.
- When `expandable` is true, the CTA toggles open/closed and renders `renderExpanded()` underneath inside the same card. Caret rotates on toggle.

### 4. New `src/components/dashboard/HealthPillars.tsx`
- Server-fn call: `getBusinessHealthDetail({ data: { tenantId } })` via `useServerFn` + `useQuery` (key `["business-health-detail", tenantId]`, 5-min stale).
- Renders 4 `PillarCard`s in a responsive grid (1 col mobile, 2 col md, 4 col xl).
- Only the Money card gets `expandable` + `renderExpanded={() => <MoneyRecommendations metrics={...} />}`. Other CTAs render as buttons with no-op handlers + a small "Coming soon" tooltip.
- Loading state: 4 skeleton cards. Error state: inline destructive message.

### 5. `src/components/dashboard/HealthWidget.tsx`
- After the existing overview content, render `<HealthPillars tenantId={tenantId} />`.
- No date-picker wiring on the detail (per previous decision — detail stays FY-to-date).

### 6. Tier gating
- Business Health is already pinned at the top of the dashboard for every tier. No tier changes needed; pillars render whenever the overview does.

## Out of scope
- AI-generated advice (rules only, per your selection).
- Wiring Efficiency / Growth / Stability CTAs — buttons render but are inert.
- Hooking the date picker into the pillar detail.
- New customers / Pipeline leads data sources (stay "Not in Xero").

## Files touched
- Edit: `src/lib/health.functions.ts`, `src/components/dashboard/HealthWidget.tsx`
- New: `src/components/dashboard/PillarCard.tsx`, `src/components/dashboard/HealthPillars.tsx`, `src/components/dashboard/MoneyRecommendations.tsx`
