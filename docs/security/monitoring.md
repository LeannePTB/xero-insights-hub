# Security monitoring

## Layers

- **Application**: structured server logs from every server function and route; Cloudflare WAF in front of all traffic.
- **Network**: Cloudflare DDoS and bot protection. All inbound traffic terminates at Cloudflare.
- **Infrastructure**: Supabase platform monitoring (CPU, queries, errors). Lovable Cloud monitors the Worker runtime.
- **Transaction (data)**: Append-only `audit_log` records connect, disconnect, sync, token refresh, role changes and admin actions.

## Tooling

- Lovable security scanner runs on every change and surfaces RLS/GRANT misconfigurations.
- Supabase linter runs after every migration.
- Rate-limit buckets (`rate_limit_buckets`) throttle high-risk endpoints (Xero connect start, invite sending, password reset).

## Logging

- All security events are written through a single server-side helper (`src/lib/audit.server.ts` → `writeAudit`), capturing actor, firm, target, IP, user agent and structured metadata.
- **Authentication lifecycle**: successful sign-ins (`login_events`), failed sign-ins (`sign_in_failed`, rate limited per IP), sign-out, MFA enrolment and failed MFA challenges.
- **Xero token lifecycle**: `xero_token_refreshed` on every refresh-token rotation, `xero_reconnect_required` when Xero rejects a refresh token, `xero_file_linked` / unlink events on connection changes.
- **Xero data access**: every successful Accounting API read is recorded as `xero_data_read` with the endpoint and organisation, de-duplicated to one entry per user/organisation/endpoint per 5 minutes so the trail stays readable.
- **Administrative actions**: role grants and revocations, plan changes, security-contact edits and audit exports (`audit_log_exported`).
- Provider errors are logged server-side (`xero_api_error`); user-facing errors do not leak upstream payloads.
- **Xero request allowance** (added 15 Sep 2026): every Xero response — accounting, assets, payroll and the token endpoint — is read for `X-DayLimit-Remaining`, `X-MinLimit-Remaining` and `X-AppMinLimit-Remaining`, and a 429 additionally for `X-Rate-Limit-Problem` and `Retry-After`. Those figures are recorded in `public.xero_rate_limits` as operational telemetry (one row per Xero file per UTC day, 30-day retention pruned on write, write path `public.log_xero_rate_limit` with the service role only). Never in `audit_log`, and no token, header or client data is stored. Surfaced by the `xero_rate_limits` posture check and a per-file card on Admin → Organisations (super admin only). A daily-limit rejection stops immediately with its own message instead of retrying, because retrying spends quota that is already exhausted.


## Anomaly review

Admin → Security shows live counters over the trail: failed sign-ins (24h), successful sign-ins (24h), Xero API errors (24h), Xero disconnections (24h), permission changes (7d) and logged data reads (24h). Counters escalate from OK to Watch to Investigate at defined thresholds so unusual activity — credential stuffing, mass disconnects, permission sprawl — is visible without querying the database.

## Evidence export

Platform super admins can export the audit trail to CSV (30 / 90 / 365 days) from Admin → Security for auditors and incident investigations. The export itself is audited.
