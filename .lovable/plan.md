# Phase 2 part 3 — live smoke suite

**Classification:** SECURITY-RELEVANT — auth/MFA, real test identities, RLS, grants, SECURITY DEFINER functions, privileged server paths, a public trigger route, presence/posture, email, billing and Xero isolation.

**Threat:** these are real logins in the production auth system. While unbanned, a test identity could reach real client data through a faulty RLS policy or a user-initiated `supabaseAdmin` path; the runner is especially dangerous while backlog 30 remains open. Test data could also leak into totals, jobs, billing, email or Xero calls.

**Invariants protected:** deny by default; aal2 on data access; super-admin alone grants no organisation/client data; caller IDs are filters; support is read-only; each access rule lives in the database; privileged clients remain system-only; tokens never leave the server.

## Confirmed current state

- The live database has no `is_test` column or test-account registry, and neither `ZZ Security Test Org A` nor `ZZ Security Test Org B` exists.
- `security_test_runs`, `record_access_test_run()` and the `access_tests` posture item already exist. The current `security:check` runs fixture, matrix and Vitest checks only.
- `security_posture()`, `online_users()` and `admin_firm_overview` do not exclude test identities or organisations.
- `adminSetSelfFirmMembership` uses `supabaseAdmin` after a TypeScript super-admin check and can currently self-join any organisation.
- Branding's `assertOrganisationStaff` delegates to `user_can_access_firm`, which includes support access; `clearClientLogo` has no audit write.
- Scheduled snapshot refresh enumerates all connected targets and can call Xero. No test exclusion exists.
- The live matrix already marks rows by `pglite`/`live`, but has no executable live layer.

## Delivery split

This is too large and risky for one change. Implement it as four separately verified Security Gate changes. Do not create or unban test accounts until Change 1 passes completely.

### Change 1 — hard test boundary and operational exclusions

1. Add `firms.is_test boolean not null default false`.
2. Add service-only `security_test_accounts` and singleton/lease-based `security_test_run_state` tables. They store user IDs, logical roles and run timing only — never passwords, TOTP seeds or tokens. For each table: create, revoke all from `PUBLIC`/`anon`/`authenticated`, grant only the minimum to `service_role`, enable RLS, and leave browser access locked.
3. Put the isolation rule once in `app_private` helpers:
   - identify test users and test organisations;
   - deny test-user → non-test-organisation and non-test-user → test-organisation access;
   - resolve client IDs to their organisation in the database;
   - assert that targets used by privileged server code remain on the permitted side of the boundary.
4. Apply the helper through RESTRICTIVE policies to organisation/client/Xero/personal-data tables and through validation triggers on relationship rows (`firm_members`, `firm_support_access`, `client_access`, invites and other links). This also prevents the test runner exploiting backlog 30 against a real organisation, while backlog 30 remains open for ordinary super admins until Phase 3.
5. Privileged user-initiated paths exercised by the suite must call the database target assertion before any `supabaseAdmin` operation. Add a static guard/inventory so a test-capable server path cannot silently omit it. The rule remains in the database; TypeScript only invokes it.
6. Exclude flagged records at their source:
   - `security_posture()` people/MFA/support/Xero/audit counts and `online_users()`;
   - `admin_firm_overview` rows and totals;
   - scheduled Xero target enumeration, snapshot/report jobs and report delivery;
   - Stripe checkout/webhook matching and billing totals; test subscriptions may be free dummy rows but may never acquire Stripe IDs;
   - email enqueue/send paths, so a test-recipient email is rejected before queueing.
7. Add a final Xero egress guard: any test organisation fails with a controlled `TEST_XERO_DISABLED` result before token lookup or `fetch`. This lets the suite call Xero-facing server functions while proving that zero Xero HTTP calls are reachable.
8. Add `test_accounts` to `security_posture()`: **Action** if a registered test identity is unbanned without an active, unexpired run lease; has membership, support grant or client access across the boundary; has an unexpected platform role; or has a live auth session older than the run window. Missing/stale run state also fails closed.
9. Add matrix rows proving both isolation directions, relationship-trigger denial, test-account exclusion from admin/posture/presence, email/billing/Xero suppression, and banned-account denial.

### Change 2 — fixture provisioning and runner lifecycle

1. After Change 1 passes and the owner adds all secrets, provision two persistent flagged organisations, one dummy client each, free/non-billable subscriptions, no Xero connection, no financial rows and no report recipients.
2. Create the seven identities listed below. The runner is the **only** test super admin and is reused for active/expired/revoked support-grant and self-approval cases; this deliberately avoids a second super-admin account.
3. Enrol and verify TOTP for every identity through the normal auth MFA flow. The owner supplies/stores credentials in Lovable secrets; no credential, TOTP seed, session or recovery material is printed, logged, returned, persisted in project files or exposed to the agent sandbox.
4. Ban all seven identities immediately after provisioning and register them in `security_test_accounts`.
5. Build one server-only runner with a database advisory/lease lock. At run start it performs a cleanup sweep, unbans only the registered identities, signs in with passwords, creates genuine aal1 sessions, completes TOTP challenges for genuine aal2 sessions, and verifies every session maps to the expected account.
6. Use `try/finally` for every run. Cleanup revokes/deletes transient support grants/invites/access rows, restores membership states and ownership, removes uploaded test logos/files and run-created rows, globally signs out every test identity, re-bans every identity, and closes the lease. The next run repeats cleanup before unbanning, covering a prior process crash.
7. Prove lifecycle controls first: a banned account cannot sign in; an expired run lease makes `test_accounts` Action; stale sessions are removed; concurrent runs are refused.

### Change 3 — matrix-driven live execution

1. Drive every `layers.includes("live")` matrix row from `docs/security/access-matrix.ts`; do not maintain a second expectation list.
2. Use real anonymous, aal1 and aal2 clients against PostgREST/RPC. Mutating cases use only dummy rows and restore them after each scenario.
3. Exercise the named server-function surfaces: client listing, Xero-data read boundary, client writes, invites, support request/approval/revocation/expiry, ownership transfer, organisation/client branding, self-join, always-free and subscription editing.
4. Add the owner decisions as matrix/backlog work:
   - **30:** runner self-join after handover expects denial but is recorded as a live-only known failure when the current function allows it. The safe pre-handover rule is documented for Phase 3; no real organisation is targeted.
   - **31:** record the null-setting fail-open and fixed admin reason as Phase 3 work. Add live tests for missing-setting refusal and caller-supplied reason, marked known failure until fixed.
   - **32:** test active support-grant writes to organisation and client branding, plus client-logo-clear auditing. If the live result confirms the suspected breach, add denied rows as known failure 32; if it does not, record the observed evidence without inventing a failure.
5. Record totals, row-level evidence, backlog-numbered known failures, fingerprint and sanitised failure details through `record_access_test_run(layer='live')`. No IDs, emails, secrets, tokens or financial payloads enter results/logs.
6. In the same run call `security_posture()` with the runner's real aal2 session. Any Action not present in an explicit source-controlled baseline `{checkId, backlog}` fails the run. Never auto-baseline. Initially expected candidates must be re-read live; likely existing items include backlog 18 (`support_write`) and 24 (`excess_grants`). Any other Action stops implementation for owner review.

### Change 4 — trigger, admin control and release gate

1. Add `POST /api/public/security/access-tests`. It accepts no test IDs or credentials, compares `SECURITY_LIVE_TEST_TRIGGER_SECRET` in constant time, rate-limits before work, takes the same database lease, runs the shared server-only runner and returns only a run ID plus aggregate status. Register this system context in the admin-client register and this unauthenticated exception in the allow-list with its containment reason.
2. Add an aal2 server function for the **Run access tests** button. It first calls a database super-admin authorisation function through the caller session, then invokes the same runner. No TypeScript role lookup becomes an authority.
3. Add the button and running/success/failure state to `/admin/security`; refresh the existing shared posture list after completion. Non-super-admin and aal1 calls must return Forbidden.
4. Extend `bun run security:check` to keep the fast fixture/matrix/static suite, then POST to the live trigger and fail on: unexpected matrix failures, fingerprint mismatch, cleanup failure, unexpected posture Action, or unavailable required secrets. It must never echo the secret or account details.
5. Regenerate the fixture/matrix docs, run `bun run security:check`, execute `public.security_posture()` through the runner session, run the database linter/security scan, and verify no new finding class.

## Exact test identities

| Identity | Logical use | Platform super admin | Persistent access |
|---|---|---:|---|
| Owner A | Owner of ZZ Security Test Org A; also used as aal1 by skipping MFA challenge | No | Owner membership in Org A |
| Staff A | Active staff in Org A | No | Staff membership in Org A |
| Owner B | Owner of ZZ Security Test Org B; cross-organisation adversary | No | Owner membership in Org B |
| Client viewer | Viewer of Org A's dummy client only | No | One test-only `client_access` row |
| Suspended member | Suspended membership behaviour | No | Suspended Org A membership |
| Removed member | Removed membership behaviour | No | Removed Org A membership |
| Security runner / support holder | Triggered runner, bare-super-admin, self-approval, and active/expired/revoked support cases | **Yes — the only one** | No membership; grants are transient per run |

Anonymous needs no account. Expired/revoked grants are states of the runner's transient grant, not extra identities.

## Secrets the owner must add in Lovable

- `SECURITY_LIVE_TEST_TRIGGER_SECRET`
- `SECURITY_TEST_OWNER_A_EMAIL`, `SECURITY_TEST_OWNER_A_PASSWORD`, `SECURITY_TEST_OWNER_A_TOTP_SECRET`
- `SECURITY_TEST_STAFF_A_EMAIL`, `SECURITY_TEST_STAFF_A_PASSWORD`, `SECURITY_TEST_STAFF_A_TOTP_SECRET`
- `SECURITY_TEST_OWNER_B_EMAIL`, `SECURITY_TEST_OWNER_B_PASSWORD`, `SECURITY_TEST_OWNER_B_TOTP_SECRET`
- `SECURITY_TEST_CLIENT_VIEWER_EMAIL`, `SECURITY_TEST_CLIENT_VIEWER_PASSWORD`, `SECURITY_TEST_CLIENT_VIEWER_TOTP_SECRET`
- `SECURITY_TEST_SUSPENDED_EMAIL`, `SECURITY_TEST_SUSPENDED_PASSWORD`, `SECURITY_TEST_SUSPENDED_TOTP_SECRET`
- `SECURITY_TEST_REMOVED_EMAIL`, `SECURITY_TEST_REMOVED_PASSWORD`, `SECURITY_TEST_REMOVED_TOTP_SECRET`
- `SECURITY_TEST_RUNNER_EMAIL`, `SECURITY_TEST_RUNNER_PASSWORD`, `SECURITY_TEST_RUNNER_TOTP_SECRET`

Use unique generated passwords and unique TOTP seeds. Account creation waits until all values are present. The owner must perform or supervise initial MFA enrolment so generated TOTP seeds go directly into Lovable secrets, never through chat or the repository.

## Files and migrations

- **Migrations:** one containment/schema migration (flags, registries, helpers, RESTRICTIVE policies, relationship triggers, exclusions, posture check); one runner-state/function migration if Change 2 needs separation. Every new public table follows create → revoke/grant minimum → RLS → policies, with callable definers guarded, fixed `search_path`, and EXECUTE revoked from `PUBLIC`/`anon`.
- **Database fixture/tests:** `scripts/dump-rls-fixture.*`, `tests/fixtures/rls-schema.sql`, `tests/access-matrix.test.ts`, new `tests/live/*`, static guards.
- **Runner/API:** new server-only runner modules, one public trigger route, one protected server-function wrapper.
- **UI:** `/admin/security` and the existing security posture controls only.
- **Docs:** access matrix source/generated copy; backlog items 30–32; admin-client register; aal1/unauthenticated allow-list; SDLC/monitoring docs; roadmap; explicit known-Action baseline.
- Existing snapshot, report delivery, billing/email and posture sources are edited only where required for test exclusion.

## Owner decisions needed

1. **Provisioning method:** recommend owner-supervised one-time MFA enrolment, then store each generated seed directly in Lovable secrets. Do not build a page or endpoint that reveals TOTP seeds.
2. **Persistent fixtures:** recommend keeping the two flagged organisations/accounts permanently banned between runs; recreating auth identities each run makes MFA enrolment and cleanup less reliable.
3. **Known Actions:** after the first runner-authenticated posture read, approve only entries already tied to a documented backlog number. Recommendation: stop rather than add any newly discovered Action automatically.

## Proof and verification

- Query grants, policies, triggers, helper/function definitions and `is_test` flags live after each migration.
- Attempt test-user reads against randomly selected non-test IDs obtained only inside a service-side assertion; verify zero rows/Forbidden and log only booleans, never real names or values.
- Attempt a normal non-test session against test IDs; verify zero rows/Forbidden.
- Prove cross-boundary membership, support-grant and client-access inserts fail in database triggers, including the runner's current self-join path.
- Prove banned sign-in fails before the first run and after `finally`; prove no test sessions or transient grants remain.
- Instrument the Xero HTTP boundary during the suite and assert zero outbound calls for test organisations.
- Verify no test identity appears in people/MFA counts or online users, and neither test organisation appears in admin totals, billing, report/snapshot jobs or email queues.
- Run the full matrix, static/meta tests, fingerprint check, posture call and linter; report passed, unexpected failed, known failures by backlog, cleanup result, posture OK/Warn/Action and any unfinished item.

## Effort estimate

**Very large:** four gated implementation changes, approximately 3–5 focused implementation/verification sessions and roughly 30–45 Lovable credits depending on live MFA provisioning and retry/debugging. Stop after any change whose Security Gate does not pass; do not proceed to the next change.
