# Phase 6 — audit the reading of client financial data

Classification: SECURITY-RELEVANT (audit trail, `supabaseAdmin` audit writes, public report link, posture check).
Invariants touched: 8 (nothing from the client's data leaves the server into the log), 10/auditability, 1 and 4 unchanged — this phase records reads, it never changes who may read.

## Step 1 — inventory (verified by reading the code, 12 Sep 2026)

| Path | Returns client figures | Audited today |
|---|---|---|
| Live Xero reads — `xeroGet`, `xeroAssetsGet`, `xeroPayrollGet` (`xero/api.server.ts`) | yes | YES — `logXeroRead` → `xero_data_read`, 5-minute de-dupe per user+tenant+endpoint (5,445 rows in the last 7 days) |
| Snapshot reads — `readSnapshot` (`xero/snapshot-read.server.ts`) and its callers (`open-invoices`, `file-capability`, `payroll`, `health`, `snapshot-compare`) | yes | NO |
| Reconciliation snapshots — `xero/recon-snapshot.server.ts` (GST/statutory screens) | yes | NO on the snapshot branch (the compute branch is audited as `live`) |
| Stored monthly report — `getStoredMonthlyReport` | yes (whole report payload) | NO |
| Report PDF — `getMonthlyReportPdfUrl` | yes | NO |
| Public report link — `report.$token` → `openLink` | yes | PARTLY — `client_report_link_opened` exists but records e-mail, IP and user agent and no read key/source |
| Report generation — `generateMonthlyReport` | yes | indirectly (its Xero reads) plus `client_report_generated` |
| Transaction search — `searchClientTransactions` | yes | YES via `xeroGet` |
| Consolidated and group loan views | yes | YES via `xeroGet` |
| Saved group loan reports — `getGroupLoanSnapshot` | yes | NO |
| Statutory accounts, cost classification, break-even inputs, scenario exclusions | no figures from the client's ledger — they are the advisor's own settings/classifications; scenario and health figures come from `xeroGet`/snapshots and are covered there | dropped from scope |
| `report_cache` table | no code reads or writes it (legacy) | dropped from scope; noted in the backlog |
| Unreconciled statement uploads | figures, but supplied by the organisation itself, not read from Xero | out of scope for this phase, recorded in the backlog |

**Unaudited today: snapshot reads, reconciliation-snapshot reads, stored report opens, report PDF downloads, saved group loan reports, and the report-link view as a *read*.**

## Step 2 — one helper

`logClientDataRead()` in `src/lib/audit.server.ts` is the only writer. Records actor, client, organisation, tenant, a short stable read key (`pnl`, `receivables`, `report:monthly`, …), source (`live` / `snapshot` / `cache` / `report` / `report_link`) and period start/end where one applies. Nothing else: no figures, account names, contact names, tokens, IP or user agent.

Actor: `requireAal2` stashes the verified `userId` in a per-request store (`src/lib/auth/request-actor.server.ts`, WeakMap keyed on the `Request`), so deep helpers such as `readSnapshot` need no signature change and the actor is always the token the middleware verified. No request context (cron/daily writer) ⇒ no actor ⇒ no read row.

Actions: reuse `xero_data_read` for `live` / `snapshot` / `cache`. Stored reports and the public link get `client_report_read`, because the target is a report row, not a Xero connection, and the actor may be absent — reusing `xero_data_read` there would be misleading.

## Step 3 — volume

- De-dupe: one row per actor + client + tenant + read key + source per 5 minutes, in process. 5 minutes matches the existing live-read window, so the two halves of one dashboard agree; a page reload inside the window is one read event, a return an hour later is a new one.
- The key always contains actor and client, so a different person or a different client can never be collapsed away.
- Expected volume: live reads run ~780 rows/day. Snapshot reads mostly *replace* live calls rather than add to them, so the expected total is ~1,000–1,500 rows/day, ≤45,000 rows inside the existing 30-day `security_settings.audit_retention_days` window, purged by `purge_expired_security_logs`. Both unchanged.
- Performance: the write is fire-and-forget (never awaited on the render path) and short-circuits on the de-dupe map before touching the database, so a card that was already read this window costs one `Map` lookup.

## Step 4 — the public report link

`openLink` gets a `client_report_read` row: report id, client, organisation, `read_key: report:monthly`, `source: report_link`, period end, `actor_user_id null`, `anonymous: true`. No token, IP or user agent. The existing `client_report_link_opened` delivery event is left exactly as it is.
Token facts confirmed by reading `report-delivery.server.ts`: stored as a SHA-256 `token_hash` (never the raw token), bound to one report and one recipient e-mail, `expires_at` enforced on every call, revocable, rate-limited, and every failure returns one generic message.

## Step 5 — visible and provable

- Posture check `read_audit`, computed from the log itself, not a list: it inspects the last 7 days of `audit_log` read rows and fails Action if any row is missing `source`, `read_key` or `client_id` (a path writing rows the wrong way), or if signed-in activity exists in the window with zero read rows (a whole path gone silent). Evidence names the sources seen and their counts.
- A static guard test refuses any new module that reads `xero_snapshots`, `reconciliation_snapshots`, `loan_consolidation_snapshots` or `client_reports.payload` unless it is listed in `docs/security/read-audit-register.ts`, so the code side cannot drift either.
- Matrix rows: member read audited, client-viewer read audited, support-grant read audited (with `access_path: support`), cross-organisation read impossible so nothing written.
- Audit screen: reads are a single filterable category ("Data reads") and are collapsed by default so the security events stay readable.

## Constraints

A failed audit write is swallowed and logged, as telemetry is today — safe on read paths, which is all this phase adds. It would not be safe for the write/lifecycle events, and none of those change.

## Verification

`bun run security:check` before/after with fingerprint, `bunx tsgo --noEmit`, Supabase linter with no new finding class, sample rows for one dashboard page view and one report-link view showing no financial values, owner screen tests, Security report.
