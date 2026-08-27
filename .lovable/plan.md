# Completeness scan, then a phased plan to finish

Read-only scan. No files were edited and no database object was changed.

## Part A — what is unfinished

### 1. Dead, unwired or half-built code

Merge leftovers from today:

- `src/components/dashboard/TrueBreakevenSection.tsx` — never imported anywhere. `DEPRECATED_WIDGET_ALIASES` in `src/lib/tiers.ts:116-121` says cash commitments are "an expandable section of the merged Break-Even card", but `BreakevenWidget.tsx` contains no such section. The alias hides the old card and the merge target never gained its content, so true break-even is currently unreachable in the UI.
- `src/lib/true-breakeven.functions.ts` — its presumed consumer is the orphaned section above; needs a targeted check before deletion.

Exports with no call site anywhere in `src/` (ripgrep-based, so treat as a candidate list rather than a verdict — dynamic `await import()` destructuring and test-only callers can produce false positives):

- Whole modules effectively dark: `src/lib/access.functions.ts` (`TIER_LIMITS`, `computeFirmAccess`), `src/lib/api/example.functions.ts`, `src/lib/xero/snapshot-compare.functions.ts`.
- Billing: `createClientCheckout`, `openBillingPortal` (`src/lib/billing-checkout.functions.ts`), `requireStripeSecret`, `stripeConfigured` (`src/lib/stripe.server.ts`). Self-serve client checkout is written but not wired to any button.
- Superseded by snapshots/merges: `getAgedPayables` (`src/lib/xero/payables.functions.ts`), `getAgedReceivables` (`src/lib/xero/receivables.functions.ts`), `getSuperPayable`, `getCurrentTaxBalance`, `getTaxLiabilityBuckets` (`src/lib/xero/reports.functions.ts`), `listXeroConnections` (`src/lib/xero/connections.functions.ts`).
- Superseded by the RPC path: `getEffectiveWidgets`, `saveClientWidgets`, `saveFirmDefaultWidgets` (`src/lib/tier-config.functions.ts`), `getClientAllowedWidgets` (`src/lib/widget-access.functions.ts`).
- Loan consolidation snapshots: `listGroupLoanSnapshots`, `getGroupLoanSnapshot`, `deleteGroupLoanSnapshot`, `autoSetupGroupLoanAccounts`, `getLoanScreenTarget` (`src/lib/loan-consolidation.functions.ts`) — a stored-snapshot feature with a table behind it and no UI.
- Security admin: `resetUserMfa`, `listSecurityDocs`, `getSecurityContact`, `saveSecurityContact` (`src/lib/security.functions.ts`).
- Support access helpers duplicated elsewhere: `isFirmMember`, `supportAccessActive`, `canAccessClient` (`src/lib/support-access.server.ts`).
- Report internals that are only reachable through their orchestrators (expected, listed for completeness): most of `src/lib/reports/monthly-report.server.ts`, `report-pdf.server.ts`, `report-verdict.server.ts`.

Catalogue vs. code: `bank_reconciliation` appears in stored `plan_levels.widgets` but is absent from `ALL_WIDGETS` in `src/lib/tiers.ts`, so it is a stored key that can never render. Every other `ALL_WIDGETS` key does have a render path in `src/routes/_authenticated/clients.$clientId.index.tsx`.

### 2. Tests that do not run

`package.json` has no `test` script and vitest is not a dependency. `src/lib/health/rules.test.ts` and `src/lib/xero/request-memo.test.ts` are written for `node:test` and execute only when run by hand. Nothing runs them automatically — including today's regression tests for the Balance Sheet envelope fix, which is exactly the class of defect that stayed invisible for months. **Zero test files execute in any project command.**

### 3. Data-quality landmines

- `plan_levels` row `free`: `is_free = false` and `allowed_tiers = {pt}`; `pt` is not a member of the `dashboard_tier` enum, so any cast of that value throws.
- Deprecated widget keys (`superannuation`, `true_breakeven`) still stored in tier and client rows. Harmless today because `renderableWidgets()` collapses them, but they make every stored row disagree with what ships.
- `bank_reconciliation` stored but unrenderable (above).
- `tier_settings` has rows only for `advisory` and `basic`; the other tiers have no kill switch.

### 4. Displayed value computed differently from the enforced one

This is the important section.

- **Widget entitlement, computed twice.** `src/lib/widget-access.server.ts` calls the database (`client_allowed_widgets` / `firm_allowed_widgets`) and is documented as the single source of truth. But the code path that actually decides what the dashboard renders — `effectiveWidgets()` in `src/lib/xero/access.server.ts:82-92` — uses a full TypeScript reimplementation of the same ceiling-minus-exclusions algorithm in `src/lib/widget-resolve.server.ts` (whose own header says "Mirrors public.client_allowed_widgets — never diverge from it"). Also used by `clients.functions.ts` and `tier-config.functions.ts`. Two implementations, one enforced, no parity check. This is the same shape as the four defects found today.
- **`client_allowed_widgets` / `firm_allowed_widgets` have no SQL definition in `supabase/migrations/`.** They exist in the database and in generated types only, so the canonical rule cannot be diffed against its TypeScript mirror from the repo.
- **Net margin, computed twice with different formulas.** Canonical `netMarginPct` in `src/lib/metrics/core.ts:9-13` divides by revenue and returns `null` when revenue <= 0; Business Health uses it. The Monthly Management Report reimplements it inline at `src/lib/reports/monthly-report.server.ts:361-362` and `:384-385`, dividing by `revenue + otherIncome` and returning `0` instead of null. Same client, same month, two different published percentages — and `metrics/core.ts` claims in a comment that both callers use it.
- **`DEFAULT_TIER_WIDGETS` fallback.** `xero/access.server.ts:82` falls back to the hardcoded table in `src/lib/tiers.ts:65-71` when there is no client row, so entitlement can come from TypeScript rather than the catalogue.

### 5. Delivery gaps

- Email delivery **works today**: `sendReport` in `src/lib/reports/report-delivery.server.ts` finalises the report, ensures the PDF, creates an email-bound single-use token per recipient and enqueues the email. It is reachable from staff UI at `src/routes/_authenticated/clients.$clientId.reports.tsx` via `ReportDeliveryDialogs.tsx`. Recipients read it at `/report/$token`; the PDF is served as a short-lived signed URL.
- **Nothing is scheduled.** The only cron jobs are the security-log purge and `xero-snapshot-refresh-daily`, which despite its name runs hourly at `:05`. There is no monthly report generation or send. Every report is generated and sent by hand.
- A client user with a login reaches the dashboard, filtered by entitlement. A client without a login reaches only the token report link. The free tier as described (a delivered monthly report) is therefore currently a manual service.

### 6. The three suspect R01/R05 results

- **TracyFinlay, cash at bank ($583,388) — genuine data, plus a code defect.** The file's `Bank` section on the Balance Sheet contains mortgage, offset and credit-card accounts (`Macquarie 33A Princess St`, `Credit Card ANZ Black`, `Offset acc for Hall St`); the section's own `Total Bank` is -583,388.01. So the negative is real for that file, not a parse error. Separately, `extractCashAtBankFromReport` in `src/lib/xero/tax-lines.ts:229-250` adds **every** row in the section to the total including the `Total Bank` summary row, so any file where that row is present is double-counted. It also reads `Cells[1]` unconditionally, which is the wrong column on a comparative Balance Sheet with more than one period.
- **X8 Enterprises critical on $33 with cash n/a — rule defect, and the most serious of the three.** `src/lib/health/rules.server.ts:131` only guards `cashAtBank.status === "input_invalid"`. When the status is `absent`, `total` is 0 and line 147 computes `const ratio = cash > 0 ? total / cash : total > 0 ? Infinity : 0` — Infinity, which clears `criticalRatio` of 1.0. R05 has the identical expression at line 230. A rule fires critical on an unknown denominator.
- **Cash n/a on several tenants — extraction defect.** `extractCashAtBankFromReport` only looks at top-level sections whose `Title` contains "bank". Files that group cash differently return `absent`, which then feeds the Infinity path above.

Nothing here needs a threshold change. The fix is to refuse to compare when either side is unknown.

## Part B — phases

Sequenced by what blocks the twenty, then what blocks charging, then the rest.

### Phase 1 — correctness before anyone is onboarded (blocks the twenty)

- Guard both R01 and R05: return the existing "unavailable" outcome whenever cash at bank is not `assessed`. Remove the `Infinity` expression rather than re-tuning it.
- Fix `extractCashAtBankFromReport`: skip `Total ...` rows in the sum, and select the report column deliberately rather than assuming `Cells[1]`.
- Decide what negative cash means for R01. A file like TracyFinlay's, where the Bank section holds loans and offsets, should not be silently compared. Suggested: treat cash <= 0 as unavailable with a stated reason, not as a critical finding.
- Add a `test` script and a runner so `rules.test.ts` and `request-memo.test.ts` actually execute. Without this, today's envelope regressions protect nothing.

Skipped: the first twenty clients receive reports that assert a critical statutory-money problem on files where cash was never read. That is the same failure mode as last week — an internal gap presented to the client as a finding about their business.

### Phase 2 — make the free tier a delivered product (blocks the twenty)

- Monthly generation and send: a scheduled job that generates the report for each eligible client for the closed month and either sends it or leaves it as a staff-reviewable draft. **Needs your approval** on two points: whether the first month goes out automatically or after staff review, and whether the verdict page is client-facing.
- The scheduler needs a `pg_cron` entry, which is a database object. **Needs your approval.**
- Recommend: draft-then-review for the first two cycles, automatic afterwards.

Skipped: twenty clients on a "delivered monthly report" tier that is delivered by hand, twenty times a month.

### Phase 3 — one entitlement implementation (blocks charging money)

- Retire `src/lib/widget-resolve.server.ts` and route `effectiveWidgets()` through the database RPC, or — if the RPC cannot serve that path — delete the RPC and make the TypeScript path canonical. One of them, not both. Today's four defects were all this shape.
- Capture the `client_allowed_widgets` / `firm_allowed_widgets` definitions into a repo migration so the rule is reviewable. Definition capture only, no behaviour change. **Needs your approval** as it touches database objects.
- Fix the `free` plan row (`is_free`, `allowed_tiers`) and remove `bank_reconciliation` from stored widget lists. Data edit, no schema change. **Needs your approval.**
- Make the Monthly Report call `metrics.netMarginPct`, and pick one denominator. Note this changes a published figure.

Skipped: an organisation can be shown widgets it is not entitled to, or denied ones it pays for, and the two answers disagree with no test catching it.

### Phase 4 — commercial surface

- Wire up self-serve checkout (`createClientCheckout`, `openBillingPortal` are already written and unreachable), or delete them.
- Retire the Standard tier, and resolve the `tier_settings` gap so every tier has a kill switch.
- Delete the deprecated widget keys from stored rows once the merged toggles have been stable for a cycle.

### Phase 5 — rules expansion

R02, R04, R07, R09. These raise the value of the report but nothing breaks without them; R01, R05 and R06 already carry page one.

## What to cut rather than build

- **The loan-consolidation snapshot feature.** Five unreachable server functions plus a table. Either wire one screen to it or delete the functions.
- **`TrueBreakevenSection.tsx` and `true-breakeven.functions.ts`.** The merge decided cash commitments live inside Break-Even; that section was never built. Cut the orphan or finish the merge, but do not leave the alias claiming something that does not ship.
- **`snapshot-compare.functions.ts`, `access.functions.ts`, `api/example.functions.ts`.** Delete.
- **The client-facing dashboard for the first twenty.** The free tier is a report. Onboarding twenty logins in the same weeks as the report scheduler doubles the surface at the worst moment.
- **The org-row replace-versus-merge model.** It only matters once organisations customise their own defaults at scale. Leave the current replace behaviour and the detachment notice already shipped.
