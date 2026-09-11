# Phase 2 of 7 — Guardrails (revised, owner-approved 11 Sep 2026)

Classification: SECURITY-RELEVANT. This phase adds proof only. It repairs no access rule; anything currently wrong is recorded as a KNOWN FAILURE with a backlog number and reported every run.

## Owner decisions (settled)
- Both test layers: PGlite fast suite **and** a live smoke suite against the real system.
- `definer_guards` exclusion list = `public.xero_required_scopes` only.
- Runs recorded in `public.security_test_runs`, never `audit_log`.
- `access_tests` posture check: Warn after 7 days.

## 1. Access matrix — one source of truth
- `docs/security/access-matrix.ts` — authoritative rows `{ role, resource, operation, expect, rule, knownFailure? }`.
- `docs/security/access-matrix.md` — generated from the `.ts` by `scripts/render-access-matrix.ts`; a test fails if it is stale.

Roles: org owner; org staff; member of a different organisation; client viewer; support-grant holder (active); **support grant expired**; **support grant revoked**; super admin with no membership; **super admin approving their own support grant**; suspended member; removed member; aal1-only member; anonymous. Plus **organisation A's owner reading organisation B**.

Resources: `firms`, `firm_members`, `clients`, every client-data table, `client_xero_orgs`, `xero_connections` non-token columns vs `access_token_enc`/`refresh_token_enc`, `xero_snapshots`, `client_notes`, `audit_log`, `subscriptions`/billing, Path C metadata, `user_presence`, `profiles` (own vs other; `display_name` vs `email`), every SECURITY DEFINER function EXECUTE-able by `authenticated`, and the named server functions.

Operations: read / insert / update / delete, plus execute.

## 2. Two test layers

### (b) PGlite matrix suite — fast, runs after every change
Extends the existing `tests/rls-isolation.test.ts` harness. The fixture must mirror Supabase auth faithfully:
`auth.uid()`, `auth.jwt()`, `auth.users`, `auth.mfa_factors`, the `anon`/`authenticated`/`service_role` roles with real table and column grants, and definer functions owned by a BYPASSRLS role so `security definer` behaves as it does live.
Meta test: an `aal1` claim is denied on a data table in the fixture, exactly as live.
`scripts/dump-rls-fixture.sh` extended to dump all policies (not just SELECT), table + column grants, callable definer bodies, and a `-- catalogue-fingerprint:` line; a mismatch against the live catalogue is reported as stale.

### (a) Live smoke suite — proves the TypeScript paths PGlite cannot see
- One flagged test organisation **"ZZ Security Test Org"** with one test client and dummy rows only. No Xero connection, so no Xero API call is reachable; authorisation is asserted to pass or fail before any Xero step.
- One dedicated account per matrix role, strong random password, TOTP secret held only in project secrets, signing in for real aal1/aal2 sessions. Only the super-admin-without-membership account holds `super_admin`, and it holds no memberships.
- Flags: `firms.is_test` and `profiles.is_test` (new boolean columns, default false). `online_users()`, the posture people counts and `admin_firm_overview` totals exclude flagged rows.
- The suite calls the **server functions** in the matrix — list clients, read Xero data, write client data, invite, support request/approve, ownership transfer — not just PostgREST, because past bypasses were TypeScript paths using `supabaseAdmin`.
- It touches only rows belonging to the test organisation and deletes anything it created at the end of each run.
- The **Run access tests** button on `/admin/security` runs the live suite (PGlite cannot run in production).
- `bun run security:check` authenticates for its recording step by signing in the dedicated **`security-runner`** test account (super-admin-without-membership) with its password + TOTP secret from project secrets, then calling `public.record_access_test_run(...)` through that aal2 session. That path is registered in the admin-client register.

## 3. Known-failure baseline
Exactly: backlog item 18 (`app_private.user_can_manage_client` still admits `is_super_admin AND platform_staff_can_access_firm`, so a support grant can write to nine `FOR ALL`-policied tables and through `app_private.move_xero_file_to_client`), plus every rule 7 violation found by the register audit in section 4, each named individually with its new backlog number. Nothing else is pre-blessed — any other failure is a regression today.

## 4. Static guard tests (`tests/static-guards.test.ts`)
1. Every `createServerFn` uses `requireAal2` unless listed in `docs/security/server-fn-aal1-allowlist.ts` with a reason (the two aal1 loggers and the unauthenticated functions).
2. Every `supabaseAdmin` use in `src/` appears in `docs/security/admin-client-register.md`. The register is built by **verifying each site**, not labelling it: system context (OAuth callback, webhook, cron, email queue, audit/telemetry, token storage) or exception that calls a database authorisation function for the caller first. A user-initiated use that does neither is recorded as a KNOWN FAILURE with a new Phase 4 backlog item and reported as such — never counted as a pass.
3. No `profiles.email` read used for an identity or recipient decision.
4. No `tenantId` read from a request body, query string or header.

## 5. Posture and gate wiring
- `definer_guards`: require `app_private.assert_aal2()`/`is_aal2()` specifically; documented exclusion `public.xero_required_scopes`.
- New `access_tests` check reading `public.security_test_runs` (`id, ran_at, ran_by, layer, passed, failed, known_failures jsonb, fingerprint_match`): Action on unexpected failures; Warn if never run or older than 7 days; OK otherwise; known failures listed with backlog numbers.
- Super-admin-only "Run access tests" button on `/admin/security`, authorised in the database (`assert_aal2` + `me_is_super_admin()`), showing per-role results, last-run time and who ran it.
- Agent command after every security-relevant change: **`bun run security:check`**. Pass = zero unexpected failures, fingerprint matches, known-failure set unchanged.

## 6. Project Knowledge section 3 — text for the owner to paste
Replace "After editing" items 1 and 2 with:
> 1. Run `bun run security:check`. Pass = zero unexpected failures, the access-matrix fixture fingerprint matches the live catalogue, and the known-failure list is unchanged. Then run `public.security_posture()` (the posture card's Re-run button shows the same result) plus the Supabase linter / security scan — no new findings.
> 2. Known failures are listed in `docs/security/access-matrix.md` with backlog numbers. Never silence one; only the phase that fixes the rule removes its marker.

## Files and migrations
Create: `docs/security/access-matrix.ts|.md`, `docs/security/admin-client-register.md`, `docs/security/server-fn-aal1-allowlist.ts`, `scripts/render-access-matrix.ts`, `tests/access-matrix.test.ts`, `tests/static-guards.test.ts`, `tests/live-smoke/*`, `src/lib/access-tests.functions.ts`, a Run-access-tests panel.
Change: `scripts/dump-rls-fixture.sql|.sh`, `tests/fixtures/rls-schema.sql`, `package.json`, `src/routes/_authenticated/admin.security.tsx`, `docs/security-backlog.md`, `roadmap.md`.
Migrations: (1) `security_test_runs` + `record_access_test_run()` + `security_posture()` changes; (2) `firms.is_test` / `profiles.is_test` flags and exclusion of flagged rows from `online_users()` and admin totals. No other policy, grant or access function is touched.

## Verification of Phase 2 itself
Inside the PGlite fixture only, and rolled back in the same transaction: drop one organisation-scoping policy, re-run a matrix case, assert the suite reports a failure. A second meta case feeds an in-memory `createServerFn` without `requireAal2` to the static guard and asserts it is flagged. No live data is read or written by either.
