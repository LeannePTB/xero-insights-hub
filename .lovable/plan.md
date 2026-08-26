# Stage 5 — Dashboard reads the snapshot

Cut-over of the client dashboard from live Xero fetches to `public.xero_snapshots`, with live fetch retained as the fallback for any parameter set the cache does not hold. No database objects, no entitlement or RLS change.

## 0. New code (nothing else changes shape)

- `src/lib/xero/snapshot-read.server.ts` (new) — one helper, `readSnapshot({ supabase, clientId, tenantId, reportKey, paramsHash })`, returning `{ payload, asAt, fetchedAt, complete, stale, ageSeconds } | null`. Staleness from `STALENESS_SECONDS` in `src/lib/xero/snapshot-keys.ts`; a row whose `payload_version !== SNAPSHOT_PAYLOAD_VERSION` is treated as absent. Reads go through `context.supabase` so RLS applies as the caller — never `supabaseAdmin`.
- `src/lib/xero/snapshot-source.ts` (new, client-safe) — the shared `Source` type every converted server function returns alongside its figures: `{ mode: "snapshot" | "live"; asAt: string | null; fetchedAt: string | null; stale: boolean; complete: boolean; reason?: "range" | "missing" | "version" | "disconnected" }`.
- `src/components/dashboard/DataSourceLine.tsx` (new) — the single component that renders the "as at" line, amber stale state, disconnected state and incomplete state. Every converted widget renders exactly this; no widget invents its own copy.
- `src/components/dashboard/RefreshSnapshotsButton.tsx` (new) — wires the existing `refreshXeroSnapshots` in `src/lib/xero/snapshot-refresh.functions.ts`.

Each converted server function keeps its existing signature and its existing live path. The snapshot is an early return, not a rewrite.

## 1. Widget-by-widget

Stored catalogue (Stage 3, `snapshotReports()` in `src/lib/xero/snapshot-keys.ts`): `balance_sheet`, `balance_sheet_prior`, `profit_and_loss_mtd`, `profit_and_loss_prior`, `profit_and_loss_ytd`, `trial_balance`, `bank_summary`, `accounts`, `organisation`, `invoices_accrec_open`, `invoices_accpay_open`.

| Widget | File | Report key(s) needed | Verdict |
|---|---|---|---|
| Business Health | `HealthWidget.tsx` / `src/lib/health.functions.ts` | `profit_and_loss_mtd`, `profit_and_loss_prior`, `balance_sheet`, `balance_sheet_prior`, `invoices_accrec_open`, `invoices_accpay_open` | Converts cleanly. Fixed period (this month vs prior), no picker. Highest-value conversion: 6 live calls today. |
| Accounts Receivable Ageing | `ReceivablesWidget.tsx` / `receivables.functions.ts` | `invoices_accrec_open` | Converts cleanly. No picker; ageing buckets are recomputed from invoice dates at read time against *now*, not against `as_at`, so buckets stay honest. |
| Accounts Payable Ageing | `PayablesWidget.tsx` / `payables.functions.ts` | `invoices_accpay_open` | Converts cleanly. |
| Tax liabilities | `TaxLiabilityWidget.tsx` / `reports.functions.ts` (`getTaxLiabilities`, `getCurrentTaxBalance`, `getProtectedMoney`) | `balance_sheet` | Converts with a caveat — has an **as-at picker**. Snapshot only when the selected date equals the snapshot's `as_at`; any other date goes live. `getTaxLiabilityBuckets` pulls several historical balance sheets and stays live. |
| Superannuation | `SuperannuationWidget.tsx` / `getSuperPayable` | `balance_sheet` | Converts cleanly (today's balance sheet only). |
| Profit & Loss | `PnlWidget.tsx` / `getProfitAndLoss` | `profit_and_loss_mtd`, `profit_and_loss_prior`, `profit_and_loss_ytd` | Converts with a caveat — **FROM/TO picker**. Snapshot only on an exact `params_hash` match against one of the three stored ranges (which covers the three default presets); every other range is live. Basis matters: stored snapshots are the organisation's default basis, so a P&L whose resolved basis differs from the snapshot's basis must go live. |
| Cash Flow | `CashflowWidget.tsx` / `cashflow.functions.ts` | `bank_summary`, `accounts`, `invoices_*` | Converts with a caveat — date picker, and today's implementation issues a `BankSummary` call **per month** in the window. Snapshot answers only the stored rolling-365-day window; anything else stays live. Lowest confidence of the convertible set; convert last. |
| Accounting break-even | `AccountingBreakevenWidget.tsx` (`useBreakevenData.ts`) | `profit_and_loss_*` | Converts with a caveat — date picker; same exact-match rule. |
| True break-even | `TrueBreakevenWidget.tsx` (`useBreakevenData.ts`) | `profit_and_loss_*` plus client-entered inputs from `client_true_breakeven_inputs` | Converts with a caveat — same as above. The user-entered inputs are database rows and always current; only the Xero side is cached. Label must make clear the *Xero* figures are as-at. |
| Balance sheet reconciliation | `BalanceSheetReconciliationWidget.tsx` / `reconciliation.functions.ts` | `balance_sheet`, `accounts`, `bank_summary` | Converts with a caveat — **month-end selector**. Only the current stored `as_at` and `balance_sheet_prior`'s month-end can be answered; all other months live. Note this widget also writes `reconciliation_snapshots`; that behaviour is unchanged and must keep recording which source it used. |
| GST reconciliation | `GstReconciliationWidget.tsx` / `gst.server.ts` | period-specific reports not in the catalogue | **Cannot convert.** BAS-period figures depend on a chosen period; the catalogue has no matching key. Stays live. |
| Fixed assets reconciliation | `FixedAssetsReconciliationWidget.tsx` | `accounts` + period movement queries not stored | **Cannot convert.** Stays live. |
| Xero File Audit | `AuditSummaryCard.tsx` / `audit.functions.ts` | writes `audit_runs` / `audit_findings`; uses paged `Invoices` with different filters | **Cannot convert.** It already has its own persistence layer and its own run cadence. Stays live and unchanged. |
| Cashflow Scenario | `ScenarioWidget.tsx` | invoices + expenses for an arbitrary chosen month | **Cannot convert.** Arbitrary month picker plus per-invoice exclusion; no stored key answers it. |
| Loan consolidation | `LoanConsolidationWidget.tsx` | per-account balance-sheet drill-down across tenants | **Cannot convert** in Stage 5. Multi-tenant, account-level; revisit only if a dedicated key is added in a later stage. |
| Transaction Search | `TransactionSearchWidget.tsx` | — | Stays live, agreed. |
| Monthly management report | `src/lib/reports/*` | — | Stays live, agreed. It is a formal deliverable and must never be built from a cached figure. |
| Notes, Unreconciled, Upgrade options | `NotesCard.tsx`, `UnreconciledCard.tsx`, `UpgradeOptions.tsx` | — | No Xero calls today. Untouched. |

So beyond the two already agreed: **GST reconciliation, fixed assets reconciliation, Xero File Audit, Cashflow Scenario and Loan consolidation also cannot convert.**

## 2. The parameter problem

Agreed with your preference, implemented literally.

Every converted server function computes the `params_hash` for the parameters it is *actually about to send to Xero*, using `snapshotParamsHash()` — the same function Stage 3 used to write the row. Then:

- **Hash matches a stored row, row is current-version, row is `complete`** → serve the snapshot. Return `source.mode = "snapshot"` with `asAt` / `fetchedAt`.
- **Hash matches but the row is missing, an older `payload_version`, or `complete = false`** → live fetch. `source.reason = "missing"` / `"version"`.
- **Hash does not match** (any user-selected range other than the stored one) → live fetch, no lookup, no approximation. `source.mode = "live"`, `source.reason = "range"`.

Three rules that follow from this and are non-negotiable in review:

1. **Never substitute periods.** There is no "nearest snapshot" fallback, no widening, no snapping the picker to the stored range. If the user asked for 1–15 Aug, they get 1–15 Aug or they get an error — never July's figures with an August heading.
2. **The hash is computed from the same parameter object the live call would use**, in the same code path, so the two can never drift. A widget that builds its params twice is a bug.
3. **Basis is part of identity.** `resolveCardBasis` can produce a basis that differs from the snapshot's; when it does, treat it as a non-match and go live. (Stage 3 stores one basis per tenant; the params hash does not currently encode basis, so the converted function must compare the resolved basis to the organisation's default explicitly.)

I do not disagree with your preference. The one thing I would add: the "live" path on a non-default range should still be visibly labelled as live, so a user who moves the picker understands why the widget suddenly takes four seconds.

## 3. Staleness on screen

One component, `DataSourceLine.tsx`, rendered immediately under the widget heading in the same slot `BasisBadge` occupies today. Copy, exact:

- **Fresh snapshot** (age < `STALENESS_SECONDS[reportKey]`, currently 30h for every key):
  `As at 26 Aug 2026 · updated 3:04am today` — muted, small.
- **Stale snapshot** (age ≥ threshold): amber pill plus line —
  `Figures may be out of date` / `As at 25 Aug 2026 · last updated 2 days ago. Refresh to update.` The refresh control sits inline at the end of this line.
- **Live** (non-default range, or snapshot missing):
  `Live from Xero · fetched just now` — muted. No amber.
- **Disconnected** (`xero_connections.status = 'disconnected'`): amber, and the figures are shown with the date they were last true —
  `Xero is disconnected. Figures are as at 25 Aug 2026 and will not update until you reconnect.` with the existing reconnect action.
- **Incomplete** (`complete = false`, e.g. invoice pagination truncated at `INVOICE_PAGE_LIMIT`):
  `Partial data — some records were not retrieved. Totals may be understated.` Amber. Never rendered as a clean figure with no caveat, because an understated payables total is worse than no total.

Rules: the line is always present on a converted widget — there is no state in which a figure appears with no provenance. Dates are Australian format via the existing Sydney helpers. Nothing here says "cache" or "snapshot" to the user.

**Business Health prints no dollar figures — that convention survives Stage 5 unchanged.** Health converting to snapshot reads changes where its inputs come from, not what it displays; the pillar strip stays qualitative. This is also the reason Health is the safest widget to convert first: a wrong input cannot produce a wrong dollar figure on screen.

## 4. The refresh button

**Once per dashboard, not per widget.** Per-widget buttons would let one render fire eleven refreshes of the same tenant, and the throttle is per tenant, so ten of them would just show errors.

Placement: in the dashboard header row of `src/routes/_authenticated/clients.$clientId.index.tsx`, beside the existing settings pills — a `Refresh figures` button with the shared "as at" summary next to it (the oldest `fetchedAt` across visible converted widgets). Widgets keep their own `RefreshCw` control only where it already exists for live data; those stay as react-query refetches.

Behaviour:

- While running: button disabled, spinner, label `Refreshing from Xero…`. A refresh takes tens of seconds for a tenant (11 reports, sequential); the widgets keep showing the previous figures with their existing "as at" line rather than blanking to skeletons.
- On success: invalidate the converted widgets' query keys; each re-reads its snapshot row and the "as at" line updates. Toast: `Figures updated.`
- On throttle rejection: `enforceRateLimit` throws `Too many requests. Please wait a moment and try again.` The button catches it and shows a non-alarming toast: `Just refreshed — you can refresh again in a couple of minutes.` It must not surface as a red error, and it must not clear the figures.
- A client-viewer sees the button only if `assertWidgetAccess` would pass; simplest is to show it whenever any converted widget rendered, since the server re-checks anyway.
- Multi-tenant clients: one button, refreshing each linked tenant in sequence, stopping at the first throttle rejection and reporting how many succeeded.

## 5. Cut-over order and verification

One `report_key` at a time, in this order — safest first:

1. `invoices_accrec_open` → Receivables
2. `invoices_accpay_open` → Payables
3. `balance_sheet` → Superannuation, then Tax liabilities (default as-at only)
4. `profit_and_loss_mtd` / `_prior` / `_ytd` → Health, then P&L, then the two break-evens
5. `bank_summary` + `accounts` → Balance sheet reconciliation, then Cash Flow

**Proof method — dual-run diff, not assertion.** For each key, before flipping the default:

- Add a temporary, staff-only `?source=compare` search param on the client dashboard route. When present, the converted server function executes **both** paths — snapshot and live — for the same resolved parameters, returns both result objects, and the widget renders the snapshot figures plus a diff strip listing every field whose values differ by more than one cent.
- Run it across all 12 clients of `cb63e0c4-4242-458a-ab7b-1e0d1853b814` plus at least one single-tenant client, immediately after a 3am refresh (so drift from real-world transactions is minimal) and record the diffs.
- Acceptance: zero differences beyond one cent on every field the widget displays, for every client. Any non-zero diff blocks that key until explained — the two most likely honest causes are pagination truncation (`complete = false`, which the diff must show) and basis mismatch.
- Keep the compare mode in the codebase behind the search param after cut-over; it is the fastest way to answer "is this figure wrong?" later.

No key is flipped for all clients at once with no diff evidence.

## 6. Call reduction, measured

Current per-render Xero calls for one Advisory-tier client dashboard, one tenant (counting what each widget's server function issues on first load; widgets behind a "load this report" prompt counted only when opened):

| Surface | Now | After Stage 5 |
|---|---|---|
| Dashboard, Health collapsed (Receivables, Payables, Tax, Super, P&L default, Cash Flow default) | ~12–16 | 0 |
| Health expanded (P&L ×2, BS ×2, AR invoices, AP invoices) | +6 | 0 |
| Widgets that stay live (GST, fixed assets, audit, scenario, loan, search) | only when opened | unchanged |
| **Total for a default render with Health open** | **~18–22** | **0** |

App-wide daily total: the scheduled refresh is a fixed cost of roughly 11–15 calls per tenant per day (11 report keys, invoice keys paginating up to `INVOICE_PAGE_LIMIT`), bounded by `MAX_XERO_CALLS_PER_RUN = 400` per run.

- **14 organisations** (the current 14 tenants Stage 3 refreshes): ~154–200 calls/day fixed, plus live-path calls only from non-default ranges and the six non-convertible widgets. Today the same estimate is dominated by dashboard renders: 20 renders/day across those tenants is already ~400 calls.
- **20 organisations** (assume ~1.5 tenants each, ~30 tenants): ~330–450 calls/day fixed. Still comfortably inside Xero's 5,000/day per-app limit, and — the point — **independent of how many times anyone opens a dashboard**, which is what makes it safe to grow.

## 7. First render, no snapshot

A client with no snapshot row (new Xero connection, or connected after the last 3am run) sees, per widget:

`Figures are being prepared. Refresh to load them now.` with the same refresh control from section 4.

- **No automatic on-demand refresh on page load.** An auto-refresh means a page open can cost 11 Xero calls, which is precisely the failure mode Stages 1–4 removed. A user opening a dashboard must never be able to trigger a Xero run implicitly.
- The button is the on-demand path, still governed by `MANUAL_REFRESH_MAX` / `TENANT_RUN_MAX`.
- Exception worth considering (flag for your decision, not assumed): fire one automatic refresh when a Xero connection is *first linked*, inside the existing onboarding path in `src/lib/xero/onboard.server.ts`, so a newly connected client is not blank until 3am. That is a connection-time event, not a render-time one, so it does not reintroduce the failure mode.
- Never show `$0`, never show an empty state that reads as "you have no invoices". Absent data and zero must be visually distinct.

## 8. What Stage 5 does not do

Confirmed, all of it:

- No new tables, columns, migrations, RLS policies, triggers or database functions. `xero_snapshots` and `xero_snapshot_runs` already exist from Stage 2.
- No change to any entitlement, plan, tier, widget key, `plan_levels`, `tier_widget_config`, `client_allowed_widgets` or `client_can_use_widget`. Which widgets a client sees is exactly what it is today; Stage 5 only changes where a visible widget gets its numbers.
- No change to the monthly management report or Transaction Search.
- No change to the cron schedule, the Stage 3 worker, or `snapshotReports()`.
- No change to access control: every converted read goes through `context.supabase` with the same `assertWidgetAccess` guard the live path uses, and `tenantId` from the request stays a filter, never a grant.

Invariants touched (section 0 of the spec): 4 and 8. `tenantId` remains a filter — the converted functions call `assertWidgetAccess` before any snapshot lookup, exactly as before, and RLS on `xero_snapshots` applies as the caller on top. Invariant 8 (fail closed) is why an unreadable or absent snapshot renders "being prepared", never a zero and never another tenant's row: the lookup is keyed by `(client_id, tenant_id, report_key, params_hash)` together.

## 9. Rollback, no deploy

Per report key, via a runtime switch rather than a code change:

- A single module `src/lib/xero/snapshot-flags.ts` reads a comma-separated env var, `XERO_SNAPSHOT_LIVE_KEYS`, listing report keys forced back to live. `readSnapshot()` returns `null` for any key in that list, so every converted function falls through to the live path it never lost.
- Reverting one key is therefore an env var change in Project Settings → Secrets and a restart — no code edit, no rebuild, no migration. Setting it to `*` reverts the whole of Stage 5.
- Because no converted function deletes its live branch, the live path cannot rot: the compare mode from section 5 exercises both on every run.
- Rollback is per key, not per widget, deliberately — a figure being wrong is a property of the stored payload, and every widget reading that payload is equally suspect.

## Files touched (implementation, when approved)

New: `src/lib/xero/snapshot-read.server.ts`, `src/lib/xero/snapshot-source.ts`, `src/lib/xero/snapshot-flags.ts`, `src/components/dashboard/DataSourceLine.tsx`, `src/components/dashboard/RefreshSnapshotsButton.tsx`.

Modified, one per cut-over step: `src/lib/xero/receivables.functions.ts`, `src/lib/xero/payables.functions.ts`, `src/lib/xero/reports.functions.ts`, `src/lib/health.functions.ts`, `src/lib/xero/cashflow.functions.ts`, `src/lib/xero/reconciliation.functions.ts`, and their widgets in `src/components/dashboard/`, plus `src/routes/_authenticated/clients.$clientId.index.tsx` for the header refresh control.

Unchanged: everything under `src/lib/reports/`, `src/lib/xero/search.functions.ts`, `src/lib/xero/audit.functions.ts`, `src/lib/xero/gst.server.ts`, `src/lib/xero/fixed-assets.server.ts`, `src/lib/xero/scenario.functions.ts`, `src/lib/loan-consolidation.functions.ts`.
