# Slim live smoke suite — implementation record (12 Sep 2026)

Classification: SECURITY-RELEVANT — new identities, auth/session handling, new
tables, a public endpoint, a posture check, real server-function execution.

## Threat and boundary

The suite creates real accounts. The threat is that those accounts, or the
endpoint that runs them, become a way into a real organisation. Boundary, all in
the database, none by convention:

- `firms.is_test` marks the one isolated organisation; `app_private.confine_security_test_accounts()`
  triggers on `firm_members`, `client_access`, `firm_viewer_access`,
  `firm_support_access`, `user_roles`, `practice_team` and `firms` refuse a test
  identity anywhere else, and refuse a platform role or practice-team row
  outright — including for `service_role`. Proved by attempting it as
  `service_role` in the suite itself.
- Accounts are banned whenever a run is not in progress (sweep → unban → run →
  re-ban + sign out + restore, in `finally`).
- Credentials and TOTP secrets are generated server-side, encrypted with
  `TOKEN_ENC_KEY`, and stored in service-role-only tables with no `anon` or
  `authenticated` privilege.
- The test organisation has no Xero connection, so no Xero API call is reachable.
- The public route's credential is one owner-added secret, compared in constant
  time, rate limited to six runs an hour before any work, returning counts only.

## What it proves that the copy cannot

Real sessions and the real server functions: the same owner on aal2 and on aal1,
staff on aal2, a standing viewer on aal2, and anonymous — calling `listClients`,
`getClient`, `renameClient`, `inviteClientViewer`, `revokeClientAccess`,
`removeOrganisationMember` and one Path C call (`listFirmMemberInvites`). Every
expectation is read from `docs/security/access-matrix.ts`; there is no second
expectation list.

## Objects

Database: `firms.is_test`; `security_test_accounts`, `security_test_run_state`;
`app_private.is_security_test_account`, `security_test_firm_id`,
`confine_security_test_accounts()`; `public.test_accounts_posture()`;
`admin_firm_overview` (test firms excluded, still `security_invoker`),
`online_users()` and `security_posture()` exclude test identities.

Code: `src/lib/live-access-tests.server.ts`, `src/lib/totp.server.ts`,
`src/lib/live-access-tests.functions.ts`,
`src/routes/api/public/security/run-access-tests.ts`,
`scripts/run-live-access-tests.ts`, the `/admin/security` button, and the posture
check wiring.

Docs: spec §16, admin-client register, unauthenticated allow-list, definer
purposes, matrix (11 new rows), backlog, roadmap.

## Secrets

Exactly one, owner-added: `SECURITY_TEST_TRIGGER_SECRET`. Everything else is
server-generated. No super-admin test account. No real organisation's data
changes.
