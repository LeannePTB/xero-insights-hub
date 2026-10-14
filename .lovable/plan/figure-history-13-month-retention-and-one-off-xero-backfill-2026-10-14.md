# Figure history: 13-month retention and one-off Xero backfill

Classification: SECURITY-RELEVANT (new system job, Xero calls, new table, new System Admin trigger). Invariants touched: 1, 2, 3, 6, 7, 8, 11.

## What the owner gets
- Daily figures are kept for at least 13 months, written down as a rule and enforced by a check.
- A "Fill 12 months of history" button in System Admin → Xero monitoring. It shows progress and a result per client: months filled, or why the client was skipped (no valid Xero connection, Xero refused, rate-limited and resuming).
- Overview cash chart and new monthly report drafts use the backfilled month-end points together with daily points, with the history labelled as "month-end from Xero" vs "daily".

## A. Retention
- Rule: `client_key_figures` rows younger than 13 months (400 days) are never deleted. No cleanup job removes them today (checked: `purge_expired_security_logs` covers audit/login only).
- Enforcement: add a test that fails if any migration or purge function deletes from `client_key_figures` or the new history table without a ≥400-day bound.
- Update `docs/security/data-retention.md` (owner decision 14 Oct; replaces "No limit set yet").

## B. Backfill design
Separate store, so a real nightly row can never be overwritten:
- New table `client_figure_history` (client_id, firm_id, tenant_id, month_end, cash, net_profit, source = 'xero_backfill', fetched_at; unique client+tenant+month_end). Same read policy as `client_key_figures` (aal2 restrictive + `user_can_access_client` and `user_can_access_tenant`), select-only to authenticated, no anon, writes service role only.
- New table `figure_backfill_runs` / items: metadata only (client, file, status, months filled, skip reason) — no figures. Readable only through an aal2 System Administrator definer function (Path C metadata).

Xero calls (about 3 per file, far under 60/min):
- One Balance Sheet with 12 monthly columns, one Profit and Loss with 12 months, one Accounts list.
- Cash uses the same selected-accounts overlay (`classifiedAccounts` + `analyseBalanceSheet`) per column, so figures match today's Cash at bank. Month-ends already holding a real nightly row are left to the nightly figure.
- Goes through the existing `xeroGet` path: per-file hourly ceiling, app-wide 429 limiter, one 401/403 refresh then mark disconnected, stop on 429 and resume next tick.

Trigger and running:
- `startFigureBackfill` server function: `requireAal2` + `assert_super_admin()` in the database, Zod input (optional organisation filter only), audited (`figure_backfill_started`, metadata only). It only queues a run; it holds no admin client.
- Processing happens inside the existing scheduled `/api/public/xero/snapshot-refresh` system job (already registered for `supabaseAdmin`), a few files per tick; re-running is safe (upsert on month_end, already-filled months skipped). No new public endpoint.
- Clients without an active connection are recorded as skipped with a reason.

Charts:
- `readFigureHistory` also reads `client_figure_history` through the caller's own session (same RLS), returning a provenance flag; daily points win on the same date.
- Overview trend extends to 12 months and states coverage honestly (month-end points vs daily).
- Report charts: month-end cash and monthly profit fall back to backfilled points when no final/sent report exists for that month; frozen into new drafts only, final/sent PDFs never regenerated.

## Access and documentation
- Matrix rows: trigger and progress — System Administrator at aal2 allowed; aal1, Owner, Staff, Viewer, Business Owner, support grant, anon denied. History table reads follow the key-figures rows (own organisation/client only; another organisation denied).
- Definer register + purposes, admin-client register (backfill worker in the existing job), security backlog, AGENTS.md rule.

## Running it once
I cannot press the button myself: it needs a System Administrator session with two-step sign-in, and running the worker by hand would skip the audited trigger. After building, the owner presses System Admin → Xero monitoring → "Fill 12 months of history"; the next scheduled ticks process Demo Practice and Positive Traction's clients and the per-client result appears there.

## Checks
tsgo, build, unit tests (column parsing, overlay per month, no overwrite of nightly rows, coverage labels), access matrix, `bun run security:check`, linter.
