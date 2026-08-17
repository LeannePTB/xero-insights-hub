# Audit logging vs Xero developer security requirements

Short answer: the audit log is a good chunk of what's needed, but on its own it isn't the full set. Xero's security standard for API consumers expects logging of authentication events, privileged/admin actions, access to Xero-sourced data, token lifecycle events, a defined retention period, tamper resistance, and some form of monitoring/alerting.

## What the app already covers

- Organisation-scoped audit log capturing: organisation created, invites created/accepted, Xero file linked/moved/disconnected, client changes, admin actions (rename, password reset/set, email change, subscription change), and Xero API errors.
- Separate login events table (who signed in, IP, user agent, time).
- Both tables are effectively append-only for app users (no insert/update/delete policies), with reads scoped by firm membership / super admin.
- Written retention policy (2 years) surfaced in the Security & Compliance admin area, and a posture check that counts rows older than retention.

## Gaps worth closing

1. **Data-access logging** — right now we log writes and errors, but not successful reads of Xero data (which tenant, which report, by which user). Xero expects access to their data to be traceable.
2. **Token lifecycle events** — connect is logged; refresh, revoke, and re-auth are not consistently logged.
3. **Auth events beyond login** — failed sign-ins, sign-outs, password changes, MFA enrol/reset are not in the log.
4. **Enforced retention** — the 2-year policy is documented but nothing purges or archives old rows automatically.
5. **Monitoring/alerting** — no alert when unusual patterns occur (repeated failed logins, mass disconnects, bulk data pulls).
6. **Export** — no way to hand an auditor a CSV of a date range.

## Proposed work

1. Add a shared server-side audit helper and call it on: Xero data reads (tenant + report key + client), token refresh/revoke, sign-out, failed sign-in, MFA enrol/reset, and role changes (super admin grant/revoke).
2. Add a scheduled purge that deletes audit and login rows older than the configured retention window, and log the purge itself.
3. Add lightweight anomaly counters on the Security posture page (failed logins in 24h, disconnects in 7d, unusual read volume) with a visible warning state.
4. Add a CSV export of the audit log for a chosen date range, super-admin only.
5. Update the data-retention and logging documents in the Security & Compliance area so they match what the code actually does.

## Technical notes

- New audit actions go through one helper writing to `public.audit_log` via the service-role client, so reads stay RLS-scoped by firm.
- Read logging is written asynchronously and must never block or fail a Xero fetch.
- Purge runs as a pg_cron job calling a security-definer function; retention window stored in a settings row so it can be changed without a migration.
- Export is a super-admin server function returning CSV, with the export itself recorded in the audit log.
