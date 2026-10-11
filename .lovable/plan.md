# Overview Re-sync — plan

Classification: SECURITY-RELEVANT (Xero API calls, `supabaseAdmin` refresh worker, client data). No change to who can read or write any row.

## What exists today (checked)
- `RefreshSnapshotsButton` — used only on the client dashboard, loops tenants one by one, 2-minute browser cooldown.
- `refreshXeroSnapshots` server function — AAL2, then `assertWidgetAccess(tenant, "health")`, then rate limits: 1 manual refresh per tenant per 2 min, 2 runs per tenant per hour; calls `refreshTenant(target, "manual")`, which claims a row in `xero_snapshot_runs` (so manual and overnight runs cannot overlap) and writes snapshots.
- Overview already shows each client's freshest snapshot time (`freshAsAt`) and reads `xero_snapshot_runs`.
- Gap found: the existing manual refresh is gated by a READ check, so in principle a support grant or external adviser could trigger it. The new Overview path will use the write/manage check instead (see Decision 1).

## What the owner will see
- Overview header (organisation and All organisations): "Re-sync" button with "Last synced <time>" beside it (latest successful sync among clients in view).
- Per-row small re-sync icon on each client the person can manage.
- While running: a status chip per row — Queued / Syncing / Done / Failed, with a plain reason:
  - "Xero connection expired — reconnect"
  - "Synced a moment ago — try again in a couple of minutes"
  - "Xero is busy — try again shortly"
  - "Not connected to Xero"
- With more than 5 clients, a confirm line first: "About N clients, roughly M minutes."
- When finished, the Overview re-reads its figures automatically. Button then cools down for 2 minutes.
- Business owners, external advisers and support-access users never see the button or per-row icons, and the server refuses them anyway.

## How it works (small)
- Browser queues the clients and runs them **one at a time** (one Xero connection in flight per person), calling one server function per client. No background job, no new table.
- Server function `resyncClient({ clientId })`:
  1. `requireAal2`.
  2. Caller-scoped manage check via the existing database predicate (`user_can_write_client`, through an existing caller-scoped RPC) — never support/read access.
  3. Resolve that client's linked Xero tenants server-side (client ID is a filter only).
  4. Same rate limits as today, plus the app-wide Xero limiter; then existing `refreshTenant(target, "manual")` → run recorded in `xero_snapshot_runs`.
  5. Write one `audit_log` row (`xero_manual_resync`, client ID, outcome, no figures).
  6. Return only status and a reason code (`complete`, `cooldown`, `reconnect`, `rate_limited`, `not_connected`, `failed`).
- 401/403 from Xero follow the existing rule: one refresh/retry, then mark disconnected → "reconnect". 429 stops the whole queue and marks the rest "Xero is busy".
- Estimate = clients × ~20 s (from recent `xero_snapshot_runs` durations if available).

## Files
- `src/lib/xero/snapshot-refresh.functions.ts` — add `resyncClient`; tighten existing `refreshXeroSnapshots` to the same manage check (Decision 1).
- `src/lib/xero/resync-reasons.ts` (new) — reason code → plain wording, plus tests.
- `src/components/overview/ResyncControls.tsx` (new) — header button, last-synced, queue, estimate, cooldown.
- `src/components/overview/OverviewView.tsx` — header slot and per-row icon/status chip.
- `src/lib/overview/overview.server.ts` — add per-row `canResync` from the existing caller-scoped `me_can_manage_client` signal (presentation only) and the header last-synced time.
- `src/routes/_authenticated/firms.$firmId.overview.tsx`, `src/routes/_authenticated/overview.tsx` — mount controls.
- `docs/security/access-matrix.ts`, `docs/security/admin-client-register.md` (existing worker use, new caller), `docs/security-backlog.md`.

## Database changes
None expected. If no authenticated-callable caller-scoped wrapper over `user_can_write_client` exists, add one tiny definer function (`me_can_write_client(_client_id)`: AAL2, `auth.uid()` only, execute revoked from PUBLIC/anon) — I will confirm before building.

## Decisions needed
1. Tighten the existing client-dashboard "Refresh figures" button to the same manage check (closes the read-gated gap)? Recommended: yes.
2. Cooldown: keep today's 1 per client per 2 min and 2 per hour, or allow more?
3. All organisations view: re-sync every manageable client across all organisations in one click, or only within each organisation? Recommended: all in view, with the estimate shown.
4. Should External advisers ever re-sync? Current plan: no.

## Checks after building
tsgo, build, reason/queue unit tests, matrix rows (business owner / viewer / support denied; member allowed), `bun run security:check`, linter, security report and backlog update.
