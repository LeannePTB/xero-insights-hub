# Last Xero login — per client and on the overview

## What you'll see

- **Client dashboard:** a new card, "Xero file activity", listing each person with access to that Xero file: name, last login date, logins this month, and documents created this month.
- **Clients overview:** a new "Last Xero login" column showing the most recent login by anyone in that file (e.g. "6 Oct"), or "—" when the file hasn't been re-authorised yet.

## Where the data comes from

Xero's Finance API has a User Activities report (`GET /api.xro/finance.xro/1.0/UserActivities`) that returns, per user of a Xero file: `LastLoginDateUtc`, `NumberOfLogins`, `NumberOfDocumentsCreated`, `UserCreatedDateUtc`. This is Xero's own data — no local counting.

## How it works

1. **New permission (scope):** add `finance.accountingactivity.read` to `public.xero_required_scopes()` in the database (the single source of truth for scopes). It passes the existing read-only guard (`.read` suffix). The existing `xero_missing_scopes()` check will then flag every connected file as missing this scope, and the existing "reconnect Xero" flow lets the file owner re-authorise once. Until a file is re-authorised, its activity data simply isn't available — nothing breaks.
2. **Nightly refresh:** one extra call per re-authorised Xero file per night (UserActivities), within the existing 25-call nightly budget. Files missing the scope are skipped — no failing retries.
3. **Storage:** new table `client_xero_user_activity` (client_id, tenant_id, xero_user_id, display name, last_login_at, logins_in_period, documents_created, period month, snapshot_at). RLS on, deny by default, read policy via the existing client-read predicate; writes only by the refresh (service role). Names are Xero users of the client's own file, so this is client data under the existing access rules — no new access path.
4. **Dashboard card:** reads the stored rows only — no live Xero call (same rule as the rest of the dashboard).
5. **Overview column:** derived from the stored rows via the existing `overview_clients()` path, showing `max(last_login_at)` per client.

## Security notes (security-relevant change)

- New scope is read-only and passes `assertReadOnlyScopes`; no write capability added.
- New table follows the standard pattern: RLS enabled, `revoke all from anon, authenticated`, per-command policies naming the role, matrix rows added to `docs/security/access-matrix.ts`.
- No change to who can read or write any existing rows; no new role or access path.
- Xero certification note: adding a scope is fine, but the Xero App Store listing will need the new scope declared in the developer portal before lodging.
- Verification: `bun run security:check` (129 tests + 18 live), typecheck, build; backlog updated in the same change.

## Technical details

- Migration: update `xero_required_scopes()` body to include `finance.accountingactivity.read`; create `client_xero_user_activity` with RLS and grants.
- `src/lib/xero/snapshot-refresh.server.ts`: after the reconciliation-date step, if the connection's granted scopes include the new scope, fetch UserActivities and upsert rows (one call per file; skip on 403/missing scope).
- New server function `getXeroUserActivity` (aal2, client-scoped via existing read predicate) for the dashboard card; overview column added in `overview_clients()` / its consumer.
- UI: `XeroActivityWidget.tsx` on the client dashboard; "Last Xero login" column in `src/routes/_authenticated/overview.tsx`.
