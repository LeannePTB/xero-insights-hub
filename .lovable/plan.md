# Xero snapshot caching — measured plan

Goal: stop fetching every figure live from Xero at render time, before ~20 client organisations onboard. No figure on screen changes.

## 1. Measured inventory

Every Xero call goes through `xeroGet` / `xeroGetAssets` in `src/lib/xero/api.server.ts`. Counts below are calls per fresh render (React Query `staleTime` 5 min hides repeats within a session only).

| Widget (key) | Server function | Xero endpoints | Calls | Tier |
|---|---|---|---|---|
| Business Health (`health`) | `getBusinessHealth` — `src/lib/health.functions.ts:278` | ProfitAndLoss, BalanceSheet | 2 | basic |
| Business Health detail (same card, on expand) | `getBusinessHealthDetail` — `health.functions.ts:502` | ProfitAndLoss ×2 (current + prior year), BalanceSheet ×2 (as-at + day-before-start), Invoices ACCREC, Invoices ACCPAY, Organisations | 7 | basic |
| Profit & Loss (`pnl`) | `getProfitAndLoss` — `src/lib/xero/reports.functions.ts:101` | ProfitAndLoss ×2 (current + prior range, `PnlWidget` fetches both) | 2 | basic |
| Receivables (`receivables`) | `getReceivables` / export — `receivables.functions.ts:44,123` | Invoices ACCREC (+ Organisations on export) | 1–2 | basic |
| Payables (`payables`) | `getPayables` / export — `payables.functions.ts:49,132` | Invoices ACCPAY (+ Organisations on export) | 1–2 | basic |
| Uncoded Bankfeed (`unreconciled`) | DB only (`unreconciled_lines`) | — | 0 | basic |
| Report basis probe (page-level) | `getOrgSalesTaxBasis` — `org-basis.functions.ts:18` | Organisation | 1 | all |
| Tax Liability (`tax_liability`) | `getCurrentTaxBalance` / buckets — `reports.functions.ts:181,245,276` | BalanceSheet (×2 when opening date needed) | 1–2 | advisory |
| Superannuation (`superannuation`) | `getCurrentTaxBalance` | BalanceSheet | 1 | advisory |
| Accounting breakeven (`accounting_breakeven`) | `reports.functions.ts:333` | BalanceSheet, ProfitAndLoss | 2 | advisory |
| True breakeven (`true_breakeven`) | `reports.functions.ts:528` + inputs | BalanceSheet | 1 | advisory |
| Cashflow (`cashflow`) | `cashflow.functions.ts:169,208` | Reports/BankSummary ×2 | 2 | advisory |
| Cashflow scenario (`cashflow_scenario`) | `scenario.functions.ts:210+` | Invoices, ProfitAndLoss ×2, Accounts | 4 | advisory |
| Xero File Audit (`xero_audit`) | `audit.functions.ts:47-52` | Organisations, Accounts, Invoices, CreditNotes, Payments | 5 | advisory |
| Balance sheet recon (`balance_sheet_reconciliation`) | `recon-shared.server.ts:66,137` | BalanceSheet + paged detail sets | 3+ | advisory |
| Fixed assets recon | `fixed-assets.server.ts:79,87` | AssetTypes, Assets (paged) | 2+ | advisory |
| GST recon (`gst_reconciliation`) | `gst.server.ts:66` | Accounts, BalanceSheet | 2 | advisory |
| Loan consolidation | `loan-xero.server.ts` | ManualJournals / Accounts | 2+ | add-on |
| Transaction Search (`transaction_search`) | `search.functions.ts:256-279` | Organisations, Invoices, CreditNotes, Prepayments, Overpayments — per tenant, per page | 5 × tenants | advisory |
| Client list badge | `getBusinessHealth` via `ClientHealthBadge.tsx` | ProfitAndLoss, BalanceSheet | 2 per client row | — |

### Duplicate fetches on one page render (single client, one Xero file)

- **BalanceSheet**: Health (1) + Tax Liability (1–2) + Superannuation (1) + Accounting breakeven (1) + True breakeven (1) + GST recon (1) + BS recon (1) — 7–8 fetches of the same report, mostly the same `date`.
- **ProfitAndLoss**: Health (1) + P&L widget (2) + Accounting breakeven (1) + Scenario (2) — 6.
- **Invoices ACCREC**: Health detail + Receivables + Scenario — 3.
- **Organisations**: basis probe + Health detail + Audit + Search — 4.
- **Accounts**: Audit + GST recon + Scenario — 3.

**Totals (fresh render, no cache):**
- (a) One client dashboard, Advisory tier, one Xero file, Health collapsed: **≈27 calls**; Health expanded: **≈32**. Snapshot-loaded cards (`reconciliation_snapshots`) can be 0 when a complete snapshot exists, so worst case ≈32, typical warm ≈22.
- (b) Organisation client list, 20 clients: **40 calls** (2 per `ClientHealthBadge`), spread across 20 tenants, serialised 3-at-a-time. Each staff page view = 40. Ten views in a morning = 400.

## 2. Rate limit headroom

Xero limits: **60 calls/min per tenant**, **5,000/day per tenant**, **10,000/day per app**, **5 concurrent calls per app**.

- **Per tenant/min**: a single Advisory dashboard render is ~27–32 calls against one tenant in a few seconds. Two people opening the same client's dashboard inside a minute breaches 60/min. This already bites today; `xeroGet` retries with backoff, which the user sees as a slow card.
- **Per tenant/day**: 5,000 is not the binding constraint for a single client.
- **App-wide 10,000/day is the real constraint.** 20 organisations × ~15 dashboard views/day × ~27 calls ≈ **8,100/day** from dashboards alone, before client-list badges (40/view), monthly report generation (dozens of P&L calls per report) and Transaction Search. Realistically we exceed 10,000/day at roughly **8–12 active organisations**, not 20.
- **5 concurrent app-wide** is the other hard wall: the badge semaphore of 3 in `ClientHealthBadge.tsx` is per browser tab, not per app. Three staff on client lists = 9 concurrent, and Xero starts rejecting.

Conclusion: the app-level daily and concurrency limits break first. Any fix must reduce *total app calls*, not just per-tenant bursts — so caching must be shared across users, not per-user.

## 3. Proposed snapshot storage (requires your approval — new database objects)

Precedent already in the project: `public.reconciliation_snapshots` (client + report_key + as_at + JSON payload + `complete` flag) and `public.report_cache`. The plan extends that shape rather than inventing a new one.

**New table `public.xero_snapshots`** — one row per (tenant, report, parameter set):

Structured columns: `id`, `firm_id`, `client_id`, `tenant_id`, `report_key` (e.g. `pnl`, `balance_sheet`, `bank_summary`, `invoices_accrec`, `invoices_accpay`, `accounts`, `organisation`), `params_hash` (stable hash of the date/basis parameters), `params` (jsonb, for debugging), `as_at` (the Xero report date the payload represents), `fetched_at`, `payload_version` (int), `status` (`complete` | `partial` | `failed`), `error` (text, nullable), `source` (`scheduled` | `on_demand`), `payload` (jsonb).

Unique on `(tenant_id, report_key, params_hash)`. Index on `(client_id, report_key)` for the badge query.

**New table `public.xero_snapshot_runs`** — one row per refresh attempt per tenant: `tenant_id`, `started_at`, `finished_at`, `requested_by`, `reports_attempted`, `reports_succeeded`, `reports_failed` (jsonb), `xero_calls`, `outcome`.

Structured vs JSON: anything used for *selection, freshness or gating* is a column (`tenant_id`, `report_key`, `as_at`, `fetched_at`, `status`, `payload_version`). Everything shaped by the widget stays in `payload`, exactly as `reconciliation_snapshots` does today.

**Payload shape changes without a migration**: `payload_version` is a code constant per `report_key` (same pattern as `src/lib/xero/recon-versions.ts` and `MONTHLY_REPORT_PAYLOAD_VERSION`). Bump the constant; any stored row with a lower version is treated as stale and recomputed on next refresh. No SQL, no backfill.

## 4. Tenancy and access

Follows the existing model (Access Control Spec §0, §6):

- Deny by default, RLS enabled, explicit policies, `to authenticated`, no `USING (true)`.
- **Read** policy: `app_private.user_can_access_tenant(auth.uid(), tenant_id)` — the same helper the other tenant-keyed tables use. `client_id` on the row is denormalised for query convenience; access is still decided by the tenant helper plus `app_private.has_client_access` / `user_can_manage_client`, never by the column being present.
- **No write policy at all.** Snapshots are written only by the refresh job with the service role, after access has been established — identical to `reconciliation_snapshots` (`src/lib/xero/recon-snapshot.server.ts`).
- `tenant_id` and `client_id` are never accepted from the client as a grant. Server functions keep resolving the tenant from the client the caller is authorised for, exactly as `assertWidgetAccess` (`src/lib/xero/access.server.ts`) does now. A caller passing another organisation's `tenant_id` fails the same check it fails today, before any snapshot row is touched.
- **Cross-organisation leak argument**: a snapshot row is reachable only if RLS says the caller can access that tenant. Because writes are service-role-only and reads are tenant-gated, there is no path where a row from organisation A satisfies a policy evaluated for a member of organisation B.
- **Consolidation / multi-company**: the consolidated view already loops the group's clients and reads each tenant separately (`src/lib/xero/consolidated.functions.ts`, `firms.$firmId.consolidated.$groupId.tsx`). It reads snapshots the same way — per tenant, each row gated individually. No group-level bypass policy, and no "if you can see the group you can see the tenants" shortcut. If a member of the group is not readable by the caller, that company is omitted and the consolidated total is flagged incomplete rather than silently short.
- Entitlement stays separate from access: `client_can_use_widget` still gates *which* snapshots a widget may read, and never widens *who* can read them.

## 5. Refresh strategy

**Scheduling mechanism.** `pg_cron` is already installed and in use for the email queue (`supabase/migrations/*_email_infra.sql`, `public.email_queue_dispatch()` calling a public route via `net.http_post`). Same mechanism, same stable URL pattern: a new route `src/routes/api/public/xero/refresh-snapshots.ts` (bearer-checked, signature-verified in-handler) invoked by a cron job. This works on current hosting — it is the pattern already running in production. No new infrastructure.

**Staggering.** The cron job runs every 5 minutes and claims a small batch (e.g. 2 tenants) from a due-queue ordered by `fetched_at` ascending, rather than refreshing all tenants on a single tick. 20 tenants × ~8 reports = ~160 calls spread over a couple of hours, and never more than one tenant's burst in flight — which also keeps us under the 5-concurrent app limit. Batch size and interval are constants in one file so they can be tuned without a migration.

**Tokens.** The job reuses `getConnectionByTenant` in `src/lib/xero/api.server.ts`, which already decrypts tokens, refreshes when within 60s of expiry, handles rotation and re-reads the row when a concurrent refresh has already rotated the token. No new token handling. On `invalid_grant` / revoked refresh token the existing path sets `status='disconnected'`; the job then skips that tenant, records a `failed` run, and the dashboard shows the disconnected state (§6) instead of stale numbers presented as current.

**On-demand "Refresh now".** The existing per-card refresh button calls a server function that (a) checks widget access, (b) enforces a per-tenant throttle via the existing `public.check_rate_limit` helper (`src/lib/rate-limit.server.ts`) — e.g. one manual refresh per tenant per 2 minutes — and (c) recomputes only the reports that card needs, not the whole tenant. Over-throttle returns the existing "Too many requests" message.

**First-ever load.** A widget with no snapshot row shows the existing `XeroLoadPrompt` / loading state (`src/components/dashboard/XeroLoadState.tsx`) with copy along the lines of "Building the first snapshot — this takes a moment", and triggers a one-off on-demand refresh for that tenant. It never shows zeros.

## 6. Failure and disconnection states

- **Stale**: every card gains a small "as at <date> · updated <relative time>" line (the reconciliation widgets already display `generatedAt`). Past a per-report staleness threshold the line turns amber with a Refresh action.
- **Disconnected**: `xero_connections.status = 'disconnected'` → the card shows the existing reconnect prompt and the last snapshot is labelled explicitly as historical, not current.
- **Partial failure**: `status='partial'` with the failed report keys recorded in `xero_snapshot_runs.reports_failed`. Any card whose inputs are incomplete renders a visible incomplete notice naming the missing report and suppresses derived composites — the same rule already enforced for the monthly report's `complete` flag and for Business Health throwing rather than scoring on throttled data. A partial snapshot is never presented as a complete picture, and never feeds a finalised report.

## 7. Migration path

**Snapshot-with-live-fallback, then snapshot-first.** Each `*.functions.ts` handler keeps its current signature and return type. Inside, before hitting Xero, it reads the snapshot for its `report_key` + `params_hash`; on hit and fresh enough it returns the payload; on miss, wrong version or `failed` it falls through to today's live path and writes the result as a snapshot. Because the payload is the same object the function already returns, no widget component changes and no figure changes. Cut-over per report key, one at a time, so a regression is isolated to one card.

Once a report key has full snapshot coverage across all live tenants, its live fallback is demoted to on-demand only (button press), not render.

Verification for "no figure changed": for each converted key, hit the function live and from snapshot for the same parameters and diff the returned payloads.

## 8. `ClientHealthBadge` N+1

Today `src/components/admin/FirmClientsSection.tsx:269` renders one badge per client row and each calls `getBusinessHealth` → 2 Xero calls, semaphored at 3 (`ClientHealthBadge.tsx`).

Fix: a new server function `getClientHealthBadges({ firmId })` that does **one** query over `xero_snapshots` for the organisation's clients (`report_key='health'`), returns `{ clientId, score, band, label, asAt, status }[]`, and makes **zero Xero calls**. `FirmClientsSection` fetches it once; `ClientHealthBadge` becomes presentational, taking the row it was given. Clients with no snapshot show the existing "Business Health unavailable" state with a reason of "no snapshot yet". The module-level semaphore and per-badge `useQuery` are deleted.

Result: 40 Xero calls → 0, and 20 requests → 1.

## 9. Phasing

**Stage 0 — measurement, no risk.** Add call counting to `xeroGet` (per tenant, per path, per day) written via the existing `public.log_xero_api_error` pattern or a counter, so headroom is observed rather than modelled. Ships alone.

**Stage 1 — kill the duplicate BalanceSheet and ProfitAndLoss fetches within one render.** A per-request memo keyed by (tenant, report, params), same idea as the `pnlCache` already in `src/lib/reports/monthly-report.server.ts`. No new tables, no schema. Cuts a single Advisory render from ~27 to roughly 15 calls. **Highest value per unit of risk — do this first.**

**Stage 2 — `xero_snapshots` + `xero_snapshot_runs` tables, RLS, no reader yet.** ⚠️ **Requires your approval: new database objects.** Ships inert.

**Stage 3 — refresh job**: public cron route, `pg_cron` schedule, staggered batches, run logging. Writes snapshots; nothing reads them. ⚠️ cron schedule is a database object — approval needed.

**Stage 4 — `ClientHealthBadge` cut-over.** Biggest call reduction, smallest surface, one card, easy to revert.

**Stage 5 — snapshot-first reads per report key**, one key per change, verified payload-identical: `balance_sheet` → `pnl` → `invoices_*` → `bank_summary` → `accounts` / `organisation`.

**Stage 6 — freshness, partial and disconnected UI**, plus per-tenant throttle on manual refresh.

Nothing in stages 0, 1, 4, 5 or 6 creates a database object. Stages 2 and 3 do, and I will not build them without your explicit go-ahead.

## Open questions

1. Acceptable staleness per report — I have assumed overnight refresh plus manual "Refresh now" is fine for balance-sheet-derived cards, and that Receivables/Payables want something tighter (hourly). Confirm.
2. Should the monthly management report keep reading live Xero (defensible: a finalised report should pin its own figures) or read snapshots? I have assumed **live, unchanged**.
3. Transaction Search is inherently interactive and cannot be snapshotted. Keep it live with a per-tenant throttle?
