# Slim live smoke suite — implementation record (12 Sep 2026)

Classification: SECURITY-RELEVANT — new tables, a new unauthenticated endpoint, real
sessions for accounts that exist only to be denied, one new secret.

No stop condition is triggered: no super-admin test account, **one** owner-added secret
(`SECURITY_TEST_TRIGGER_SECRET`; `TOKEN_ENC_KEY` already exists), and no real
organisation's data is read or written by any part of this.

## What live testing adds, and only that

`bun run security:check` already proves 1,395 rules against a faithful copy. The live
suite exists for two things the copy cannot produce: a **real session** (in particular the
same person on aal2 and on aal1) and the **real server functions**. Expectations are read
from `docs/security/access-matrix.ts` by `(role, resource, operation)` — there is no second
expectation list.

## 1. Database

- `firms.is_test boolean not null default false`; one row `ZZ Security Test Org` with two
  dummy clients, no Xero connection, no financial data. Excluded from
  `admin_firm_overview`, from `online_users()` and from the posture people counts; its
  three addresses are inserted into `suppressed_emails`, so no email can leave for them,
  and it owns no Xero connection so no scheduled job has anything to do.
- `public.security_test_accounts` (user_id, label owner|staff|viewer, password ciphertext,
  TOTP ciphertext, factor id) and `public.security_test_run_state` (single row: running,
  started_at, run_id). RLS on, `revoke all ... from anon, authenticated`, per-command
  policies naming `service_role` only, plus the aal2 restrictive guard. No `anon` or
  `authenticated` grant at all — the runner reaches them with the service role.
- Secrets at rest: passwords and TOTP secrets are wrapped with the existing
  `TOKEN_ENC_KEY` (`src/lib/crypto.server.ts`) and never returned to any caller.
- **Confinement, in the database.** `app_private.is_security_test_account(uuid)` plus
  `BEFORE INSERT OR UPDATE` triggers on `firm_members`, `client_access`,
  `firm_viewer_access`, `firm_support_access`, `user_roles`, `practice_team` and `firms`:
  a test account may hold a membership or grant **only** inside the test organisation, and
  may never hold a role, a support grant, practice-team membership or ownership of a real
  organisation. Proved by matrix rows, not by convention.
- `public.test_accounts_posture()` — same shape as `read_audit_posture()`: Action when a
  test account is unbanned outside a run, holds anything outside the test organisation, or
  has a session older than the run window.

## 2. Runner

`src/lib/live-access-tests.server.ts`, service-role only:

1. **Sweep** — re-ban every test account and clear stale run state left by a crash.
2. Mark the run started, unban the three accounts.
3. Build sessions: owner aal2 (password + a server-generated TOTP code), owner aal1
   (password only, second factor skipped), staff aal2, viewer aal2, plus anonymous.
4. Probes — real server functions over HTTP with the session's bearer token: read a client
   dashboard, write client data, list clients, invite and revoke a client viewer, remove a
   member, and one Path C admin call (an owner asking for pending member invitations, which
   must be refused). Each asserts the matrix row for that role/resource/operation.
5. `finally` — re-ban, sign out every session, delete rows the run created, clear run state.
   Recorded in `security_test_runs` with layer `live`, so the `access_tests` posture check
   goes green after a clean run.

TOTP codes are generated server-side (`src/lib/totp.server.ts`, HMAC-SHA1, RFC 6238).

## 3. Ways in

- `POST /api/public/security/run-access-tests` — constant-time secret comparison, rate
  limited, registered in the admin-client register and the unauthenticated allow-list.
- A super-admin-only "Run access tests" button on `/admin/security` (aal2 + super admin
  asserted in the database).
- `bun run security:check` calls the same suite when the secret and a URL are present, and
  says SKIPPED when they are not.

## 4. Close out

Matrix rows for confinement and for the smoke probes; fixture, definer register and
generated matrix regenerated; spec section, backlog, roadmap; `bun run security:check`,
typecheck, linter.
