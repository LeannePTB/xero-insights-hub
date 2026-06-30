## Two related fixes for the Efficiency pillar

### Problem 1 — "Wages as % of rev" reads 0% / "Not tagged"

In `src/lib/health.functions.ts` (~L487-496), wages are pulled from the P&L by:
1. `pnlSectionRows` matching sections whose title contains `"expense"` or `"operating"`.
2. A name regex `/wage|salary|salaries|superannuation|payroll|staff/i`.
3. Divide by `pnl.income`.

Two real causes of the miss:
- **`pnlSectionRows` doesn't recurse.** It only reads direct children of a top-level Section. When Xero nests accounts (tracking categories, grouped sub-sections inside "Operating Expenses"), the walker returns nothing → wages = 0 → "Not tagged".
- **Regex is fragile.** Common names like "Employee Benefits", "Contract Labour", "Sub-contractors", "Director Fees", "PAYG", "KiwiSaver", "Bonus", "Commission" don't match even when rows are found.

### Problem 2 — Efficiency pillar CTA isn't wired

In `HealthPillars.tsx` only the Money pillar passes an `expanded` renderer (`MoneyRecommendations`). Efficiency, Growth, and Stability fall through to the "Coming soon" path in `PillarCard.tsx`.

## Plan

### Wages fix
1. Make `pnlSectionRows` recurse into nested `Section` rows so leaf accounts are collected at any depth.
2. Broaden the wage-account regex to include: `employee`, `contract labour`, `subcontract`, `director fee|directors fee`, `PAYG`, `kiwisaver`, `bonus`, `commission`.
3. Prefer explicit tags when present: add a new `'wages'` value to the cost-classification type (small migration + a "Wages" toggle in the existing Cost Classifications settings UI). If any account is tagged as wages, sum tagged accounts instead of running the regex. Detection is the fallback when nothing is tagged — same pattern Break-Even already uses.
4. Only render "Not tagged" when both tags are empty and detection finds zero matches.

### Efficiency CTA wiring
1. Add `getEfficiencyRecommendations(metrics)` to `src/lib/health.recommendations.ts`, mirroring `getMoneyRecommendations`. Rules driven by the live metrics:
   - **Wages too high** (wages% > 50): suggest reviewing roles, freezing hires, productivity per FTE, raising prices.
   - **Wages untagged** (Not tagged): one-click link to Settings → Cost Classifications to tag wage accounts.
   - **Bad debts present** (>0% of revenue): tighten credit checks, deposits up-front, dunning cadence.
   - **Bills paid late** (on-time% < 90): negotiate terms, batch payment runs, set reminders before due date.
   - **Top-customer concentration** (if available): diversification actions.
2. Create `src/components/dashboard/EfficiencyRecommendations.tsx` (same shape as `MoneyRecommendations`).
3. In `HealthPillars.tsx`, extend the renderer map so `p.key === "efficiency"` uses `EfficiencyRecommendations`. Pass `clientId` through so the "Tag wage accounts" item can deep-link.
4. Leave Growth and Stability on "Coming soon" — we'll do those next.

### Files touched
- `src/lib/health.functions.ts` — recurse sections, broaden regex, load wage tags, prefer tagged sum.
- `supabase/migrations/<new>.sql` — add `'wages'` classification type (+ GRANTs already in place on the table).
- Cost Classifications settings page — add the "Wages" option alongside Fixed / Variable / Excluded.
- `src/lib/health.recommendations.ts` — add `getEfficiencyRecommendations`.
- `src/components/dashboard/EfficiencyRecommendations.tsx` — new.
- `src/components/dashboard/HealthPillars.tsx` — register the Efficiency renderer.

### One decision

Tagging approach for wages:
- **(a)** Detection-only (recurse + broader regex). No schema/UI change. Faster, but can still miss oddly named accounts.
- **(b) Recommended** — add an explicit "Wages" tag in Cost Classifications. Detection becomes the fallback. Same reliability model as Break-Even, and the Efficiency CTA gets a meaningful "Tag wage accounts" action.
