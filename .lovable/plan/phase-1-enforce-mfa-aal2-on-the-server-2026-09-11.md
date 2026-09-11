# Phase 1 — Enforce MFA (aal2) on the server

Classification: SECURITY-RELEVANT (auth/MFA, RLS, SECURITY DEFINER functions, public routes).

## Verified today by read-only inspection

- `src/integrations/supabase/auth-middleware.ts` (marked auto-generated) validates the bearer token and reads `sub` only — no `aal` check.
- aal is checked only in the browser: `src/routes/_authenticated/route.tsx`, `src/routes/auth.tsx`, `src/routes/auth_.mfa-verify.tsx`, `src/components/auth/MfaGate.tsx`.
- 220 `createServerFn` definitions across 58 files; 213 use `.middleware([requireSupabaseAuth])`.
- 52 RLS-enabled tables in `public`; no policy or function references `aal`.
- 28 functions in `public` are EXECUTE-able by `authenticated` (26 SECURITY DEFINER); `app_private` helpers are also EXECUTE-able by `authenticated` but not exposed through the API.
- 4 users, 2 with a verified TOTP factor; 3 super admins.

## 1. Server functions

Do not edit the auto-generated middleware. Add `src/lib/auth/require-aal2.ts`:

- `requireAal2` — a function middleware declaring `.middleware([requireSupabaseAuth])` and asserting `context.claims.aal === 'aal2'`, otherwise throwing a generic `Unauthorized: multi-factor authentication required`. It re-exports the same context (`supabase`, `userId`, `claims`) so call sites need no other change.
- Every `.middleware([requireSupabaseAuth])` becomes `.middleware([requireAal2])` — 213 sites in 56 files.

Proving none are missed:
- After the change, `rg "requireSupabaseAuth" src --glob '!src/integrations/**' --glob '!src/lib/auth/require-aal2.ts'` must return only the documented aal1 exceptions below.
- A checked list of all 220 `createServerFn` definitions, each classified as aal2, deliberate aal1 (listed in section 3), or unauthenticated public/system.
- Add the rule to `app_private.security_self_check()` scope notes and to the backlog checklist so new functions are caught in review.

Deliberate aal1 server-function exceptions (they exist to record the sign-in itself, before MFA can be reached):
- `logAuthEvent` (`src/lib/audit.functions.ts`) — keeps `requireSupabaseAuth`, writes audit rows only.
- `logLogin` (`src/lib/login-log.functions.ts`) — same reason.
Both are write-only, take no caller-supplied identifiers that grant reads, and return nothing.

## 2. Database layer

- New `app_private.is_aal2()` — `stable`, `security invoker`, `set search_path = ''`, returning `coalesce(auth.jwt() ->> 'aal', '') = 'aal2'`. `revoke execute from public, anon`; grant to `authenticated`.
- Add one **RESTRICTIVE** `FOR ALL TO authenticated USING (app_private.is_aal2()) WITH CHECK (app_private.is_aal2())` policy per data table. Restrictive policies intersect with existing permissive ones, so no current permission is widened and `service_role` (which bypasses RLS) is unaffected — the nightly job, webhooks, email queue and OAuth callback keep working.

In scope (organisation, client, Xero, audit or personal data), all 40 of:
`firms, firm_members, firm_support_access, clients, client_access, client_notes, client_reports, client_subscriptions, client_xero_orgs, client_cost_classifications, client_statutory_accounts, client_true_breakeven_inputs, consolidation_groups, consolidation_group_members, loan_consolidation_accounts, loan_consolidation_snapshots, reconciliation_snapshots, unreconciled_uploads, unreconciled_lines, scenario_exclusions, xero_connections, xero_snapshots, xero_snapshot_runs, xero_api_errors, xero_assessment_contact, audit_log, audit_runs, audit_findings, audit_finding_snoozes, login_events, billing_events, subscriptions, signup_requests, access_invites, report_recipients, report_cache, email_send_log, dashboard_configs, dashboard_card_order, profiles`.

Deliberately excluded, with reason:
- `plan_levels`, `tier_settings`, `tier_widget_config` — platform configuration the dashboard needs to render; recorded earlier as configuration, not tenant data. (Card rendering happens only behind aal2 anyway; excluded to avoid coupling this phase to the tier-catalogue decision.)
- `xero_oauth_states`, `rate_limit_buckets`, `email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens`, `security_settings`, `security_contact_details` — reached only by service-role system paths; adding a restrictive authenticated policy changes nothing, so leaving them out keeps the migration minimal. Confirmed by checking their existing policies before the migration.

`profiles` is in scope but verified first: if any pre-aal2 screen reads it, the restrictive policy is applied with a documented exception instead.

SECURITY DEFINER functions: add `if not app_private.is_aal2() then raise exception 'multi-factor authentication required'; end if;` as the first statement of every `public` function EXECUTE-able by `authenticated` that touches organisation or client data — `assert_client_write_access, change_firm_plan, client_allowed_widgets, client_can_use_widget, client_entitlement, client_removal_impact, delete_client_report, delete_statement_upload, firm_allowed_widgets, firm_can_use_widget, firm_has_consolidation, firm_plan_limits, firm_subscription_state, remove_client, reset_org_tier_widgets, set_all_client_tiers, set_client_tier_widgets, set_client_widget_enabled, set_firm_default_widgets, set_org_widget_enabled, set_platform_tier_widgets, set_tier_enabled, transfer_organisation_ownership, user_can_access_client, user_can_access_firm`. Excluded: `xero_required_scopes`, `xero_missing_scopes` (static scope constants), `org_addon_widgets` (invoker, no definer bypass). `app_private` helpers get no guard of their own — they are not API-reachable and are called from inside guarded policies/functions; guarding them would break service-role system paths.

Migration is one file, additive, no table/column/grant/trigger changes beyond the new function and the restrictive policies.

## 3. Flows that legitimately run before aal2

| Flow | Touches | Why it keeps working |
| --- | --- | --- |
| Email/password sign-in | Supabase Auth only, then `logAuthEvent` / `logLogin` | Auth is outside our RLS; both loggers stay aal1 |
| Failed sign-in logging | `logFailedSignIn` (already unauthenticated, admin client) | Unchanged |
| Sign in with Xero | `src/routes/api/public/xero/callback.ts`, service role | Service role bypasses RLS; mints an aal1 session that then hits the same enrol/verify gate |
| MFA enrolment / verification | `auth_.mfa-enroll.tsx`, `auth_.mfa-verify.tsx`, `MfaGate.tsx`, Supabase Auth API | No app table or definer function touched |
| Invite acceptance (`signup.$token`) | `getInvitePublic`, `acceptInvite` — no auth middleware, admin client | Unchanged |
| `set-password`, password recovery | Supabase Auth | Unchanged |
| Public report link (`report.$token`) | `describeReportLink`, `openReportLink` — no auth middleware, admin client | Unchanged |
| Unsubscribe | `unsubscribe.tsx`, token tables via service role | Excluded tables; unchanged |
| Xero OAuth callback, Stripe webhook, cron snapshot refresh, email queue | `src/routes/api/public/*`, `pg_cron`, service role | Service role bypasses RLS and definer guards are only reached by `authenticated` calls — verified per path before merge |

Each row is re-verified by reading the file and confirming the client it uses before the migration is written.

## 4. Lockout safety

- The super admin without a verified factor already lands on `/auth/mfa-enroll` at next sign-in; enrolment is Supabase Auth only, so the new database guard does not block it. They enrol, reach aal2, and continue.
- No path can lock out every owner: two accounts already hold verified factors, and enrolment is always available to anyone who can sign in.
- MFA reset stays possible through the backend users administration surface (service role), which is unaffected by these changes. No app-side reset function is added in this phase.
- Rollout order: server middleware first, database second, so a problem is visible before the harder-to-reverse layer lands. Each is a separate, individually revertible change.

## 5. Verification after implementation

Run, not assert:
- (a) Mint an aal1 session for a test user and call two representative server functions (`getClients`, `getMyContext`) — expect the aal2 error, no data.
- (b) With the same aal1 token against PostgREST directly: `select` on `clients`, `firms`, `xero_connections`, `audit_log` returns zero rows; `rpc/user_can_access_firm` and `rpc/assert_client_write_access` raise the MFA exception.
- (c) With an aal2 session: the same reads return exactly the rows they return today (row-count comparison captured before and after), and a client page, loan consolidation, and the admin organisation overview render unchanged.
- Supabase linter / security scan: no new findings.
- `select count(*) from pg_policies where schemaname='public' and permissive='RESTRICTIVE'` matches the table list.
- `bunx tsgo --noEmit -p tsconfig.json` clean.

## 6. Docs

- `docs/security/access-control.md` — correct the MFA section to state, accurately, that aal2 is enforced in the middleware and in RESTRICTIVE policies plus definer guards, and list the aal1 exceptions.
- `docs/security/access-control-spec.md` — add the aal2 rule to the invariants section.
- `docs/security-backlog.md` — open the Phase 1 item, close it on completion with the verification evidence, and record the excluded tables and the two aal1 server functions as decisions.

## 7. Needs an owner decision (Security Gate §4)

1. Keeping `logAuthEvent` and `logLogin` at aal1 — a documented exception to rule 2.
2. Excluding the tier/plan configuration tables from the restrictive policy in this phase.
3. Whether the aal1 exceptions should be timeboxed and audited, given a Xero-minted aal1 session can call them.
4. Confirmation that the un-enrolled super admin will enrol at next sign-in, since after this change no aal1 session reaches any data.
