# Security backlog — Traction Advisory

Verified against code and database 6 September 2026. Re-verify before acting on any item.
Referenced by Access Control Spec §12. Update this file in the same change that closes an item.

## Closed — do not reopen on the strength of an older note

- **Token column exposure.** `authenticated` holds SELECT on 13 non-token columns of `xero_connections`; `access_token_enc` and `refresh_token_enc` have no grant. The privilege check runs before RLS, so a browser read of those columns fails before any policy is evaluated. No `select *` against that table exists in the codebase.
- **`FORCE ROW LEVEL SECURITY` — WON'T DO.** All `public` tables are owned by `postgres`, which has `rolbypassrls`; `service_role` bypasses too. FORCE is evaluated after BYPASSRLS, so it changes nothing for any role the app connects as. Only worth revisiting if table ownership moves to a non-bypass role.
- **Plan `free` / `pt` enum.** No `free` row exists in `plan_levels`. `pt` appears in no `allowed_tiers`. `plan-tiers.ts` filters unknown keys and falls back to `basic`; nothing casts a raw string to `dashboard_tier` (enum: `basic, advisory, investigate, multi_company`).
- **Grant hygiene, 6 Sep 2026.** `anon` DML revoked on `xero_snapshots` and `xero_snapshot_runs`; `INSERT` revoked from `authenticated` on `audit_log`. Both were denied by RLS beforehand — the grants contradicted the model, they were not live holes.
- **OAuth return-origin allow-lists, 6 Sep 2026.** `*.lovable.app` wildcard removed. Single `assertAppOrigin` in `src/lib/site-origin.ts` used by every `return_origin` writer; `getSafeReturnOrigin` validates every redirect consumer against the same explicit host list.
- **Policy tidy-up round 2, 6 Sep 2026.** Backlog items 2 and 3 closed. On `xero_connections`, `Users manage own xero connections` and `firm owners manage firm xero connections` were dropped and re-created `FOR SELECT TO authenticated` with byte-identical USING expressions (`auth.uid() = user_id`, and `firm_id IS NOT NULL AND app_private.is_firm_owner(auth.uid(), firm_id)`), removing the phantom write half; readable-row sets are unchanged because SELECT still unions the same three permissive expressions, including the only one admitting the single `firm_id IS NULL` row. On `xero_oauth_states`, `Users manage own oauth states` was retargeted from `PUBLIC` to `authenticated`, qualifier and WITH CHECK unchanged; `anon` holds no grant on that table and every anonymous-stage read/write in the sign-in flow goes through `supabaseAdmin`, so no anonymous path depended on it.
- **Function tidy-up round 1, 6 Sep 2026.** `app_private.shares_firm_with` now requires `status = 'active'` on both sides of the join (defect: removed/suspended members still counted). `public.xero_tenant_already_linked` EXECUTE revoked from `authenticated`/`anon`/`PUBLIC` — only `service_role` callers exist. `public.xero_missing_scopes` keeps EXECUTE for `authenticated` (called through `context.supabase`) and now resolves the connection's `firm_id` and requires `has_firm_access` or `platform_staff_can_access_firm`, returning `null` otherwise. `app_private.firm_ids_for_tenant` **left unchanged**: the `snoozes write for firm staff` policy on `audit_finding_snoozes` calls it directly, so revoking EXECUTE from `authenticated` would break that policy.

- **Membership `status` sweep, 7 Sep 2026.** Every read of `firm_members` in the database (both schemas) already filtered `status = 'active'` — `has_firm_access`, `is_firm_owner`, `get_user_firm_id`, `shares_firm_with`, `transfer_organisation_ownership`; no RLS policy reads the table directly. Fifteen application-code checks did not, and were fixed by adding `.eq("status", "active")` and nothing else: `consolidation-groups.functions.ts` (assertFirmAccess, group detail `canSeeFigures`), `clients.functions.ts` (x3: list scope, explicit-firm check, default-firm pick), `firms.functions.ts` (x3: super-admin overview "own" flag, `listMyFirms`, `getMyFirm`), `access.functions.ts` (`computeFirmAccess`), `roles.functions.ts` (`getMyContext`), `xero/access.server.ts` (member → investigate tier), `loan-consolidation.functions.ts` (`firmMemberRole`), `xero/client-orgs.server.ts` (`userCanManageClient`), `xero/onboard.server.ts` (`assertFirmCanAddClient`), `xero/consolidated.functions.ts` (`resolveGroup`). All 12 `firm_members` rows are `active`, so no current behaviour changed. `client_access` has no expiry or revoked column — a row is the grant — and every `firm_support_access` read used for authorisation goes through `app_private.firm_support_access_active`, which requires `granted`, `revoked_at is null` and `expires_at > now()`.


- **Server-side MFA (aal2) enforcement, 11 Sep 2026 — Phase 1 of the remediation programme, CLOSED.** Before this change MFA existed only in the browser (`MfaGate.tsx`, `_authenticated/route.tsx`); `requireSupabaseAuth` never read the `aal` claim, and no policy or function in `public`/`app_private` referenced `aal`, so an aal1 session — including the one minted by "Sign in with Xero" — could call server functions and PostgREST directly. Now: `src/lib/auth/require-aal2.ts` wraps the generated middleware and is used by 211 of 213 authenticated server functions; `app_private.is_aal2()` backs a RESTRICTIVE `mfa_aal2_required` policy on 40 data tables; `app_private.assert_aal2()` guards 25 `public` SECURITY DEFINER functions executable by `authenticated`. Verified with a live non-aal2 token belonging to a super admin who is an active member of all 4 organisations: `clients`, `firms`, `xero_connections`, `audit_log`, `profiles` all returned `[]` (12 clients and 4 organisations exist), and `rpc/user_can_access_firm` and `rpc/assert_client_write_access` returned `42501 MFA_REQUIRED`. **Completed 11 Sep 2026 with the owner's corrections:** the restrictive policy now covers every `public` table `authenticated` holds a privilege on — 49 tables, adding `tier_widget_config`, `security_settings`, `security_contact_details`, `user_roles`, `email_send_state`, `email_unsubscribe_tokens`, `rate_limit_buckets`, `suppressed_emails`, `xero_oauth_states`. `public.xero_missing_scopes` gained the aal2 guard (it is SECURITY DEFINER and reads `xero_connections` for a caller-supplied id). Only `plan_levels` and `tier_settings` are excluded (owner-approved: public plan/tier catalogue), and only `xero_required_scopes` is an unguarded definer function (fixed constant list). All nine newly covered tables returned `[]` to the aal1 token while `plan_levels` and `tier_settings` still returned rows, and `rpc/xero_missing_scopes` returned `null`. `app_private` is not exposed to PostgREST — `Accept-Profile: app_private` returns `PGRST106: Only the following schemas are exposed: public, graphql_public`. The two aal1 loggers now meet the owner's conditions: fixed allow-list action, actor and email from the token, no caller free text, and per-user rate limiting via `public.check_rate_limit`. `EXECUTE` on `app_private.is_aal2()` / `assert_aal2()` was granted to `service_role` (which already bypasses RLS) so the helper is testable from system context. Not verified: a live aal2 session — admin-minted sessions cannot enrol or challenge a factor, so aal2 behaviour rests on the unchanged permissive policies plus the `is_aal2()` body. Requests with no JWT claims (cron, migrations) and `service_role` requests are treated as system contexts inside `is_aal2()`, matching the fact that they already bypass RLS. Not verified in that change: an aal2 browser session was not driven end to end.

## Open

- **New-table grants rule.** Every new `public` table must explicitly revoke default privileges from `anon` and grant only the minimum privileges each allowed role needs; RLS is not a substitute for grant hygiene.
- **Names are not collected by every public invite/signup path.** Leave `profiles.display_name` null when no real name was supplied; add name collection in a separate reviewed change.
- **Display names are not identity.** A person can choose the same display name as someone else. Online tooltips and admin people lists must always pair the display name with the verified email from `auth.users`, never `profiles.email`.

21. **Authorisation is re-implemented in TypeScript before `supabaseAdmin` — systemic rule 7 violation (opened 11 Sep 2026, Phase 2 audit; fix in Phase 4).** Verified by reading each call path and recorded per file in `docs/security/admin-client-register.md`. The dominant pattern before a `supabaseAdmin` call is a hand-rolled check against `user_roles` / `firm_members` / `client_access` / `client_xero_orgs` rather than a database authorisation function (`user_can_access_firm`, `user_can_access_client`, `assert_client_write_access`, `client_entitlement`). The main offenders are `src/lib/xero/access.server.ts` (`assertWidgetAccess`, the dashboard gate every Xero widget inherits), `src/lib/widget-access.server.ts`, `src/lib/loan-consolidation.functions.ts` (`canManageClient`/`canReadClient`), `src/lib/clients.functions.ts`, `src/lib/xero/client-orgs.server.ts`, and six separate local copies of `assertSuperAdmin` (`admin`, `advisors`, `billing`, `firms`, `invites`, `security`, `xero/orphan-connections`). A typo in any one copy silently opens that surface. Sixteen further files use `supabaseAdmin` on paths this audit could not trace end to end; they are recorded fail-closed as `unverified` in the register and must be individually verified in Phase 4. **Checked and rejected as claims:** `getAuditAnomalies`/`exportAuditLogCsv`/`getRetentionStatus` and `listLoginEvents` do gate on a role first — the gate is TypeScript, not an open endpoint.
22. **`profiles.email` is still read as a display fallback (opened 11 Sep 2026).** Six sites (`clients.functions.ts`, `reports/monthly-report.server.ts`, `reports/monthly-report-context.server.ts`, `reports/report-verdict.server.ts`, `support-access.functions.ts`, `xero/orphan-connections.functions.ts`) fall back to `profiles.email` when `display_name` is null. The verified email must come from `auth.users`. `tests/static-guards.test.ts` fails on any new occurrence.
23. **Delete the template endpoint (opened 11 Sep 2026).** `src/lib/api/example.functions.ts` exposes an unauthenticated `getGreeting`. It touches no data, but it should not ship.

24. **Excess default grants on `public` tables (opened 11 Sep 2026, Phase 2; clean up in Phase 7).** Supabase grants `anon`/`authenticated` ALL privileges on every new table, so most tables still carry INSERT/UPDATE/DELETE/TRUNCATE for `authenticated` with no permissive policy for that command, and some carry privileges for `anon`. RLS denies the writes today, so this is grant hygiene rather than a live hole — the same mistake fixed on `user_presence` and `security_test_runs`. The new `excess_grants` check in `public.security_posture()` lists the affected tables and commands on every run. Do not re-grade its Warn/Action results before the cleanup lands.

25. **An active support grant cannot read four of the client tables (opened 11 Sep 2026, Phase 2 matrix run).** Proved in the PGlite matrix suite: the read policies on `clients`, `client_statutory_accounts`, `report_cache` and `scenario_exclusions` do not name `app_private.platform_staff_can_access_firm`, so a holder of a valid Path B grant sees nothing on those tables — including the client list, which makes the grant close to unusable. This fails closed (Spec §0.8), so it is a gap, not an incident. Decide with the owner whether Path B is meant to cover the client list before changing any policy; nothing was changed in Phase 2.

26. **An organisation cannot read its own audit rows (opened 11 Sep 2026, Phase 2 matrix run).** Spec §3 says an organisation sees its own `audit_log` rows; the only read policy on `audit_log` is `app_private.is_super_admin(auth.uid())`, so an organisation owner reads none. Fails closed. Either implement the organisation-scoped read policy or amend the spec.


27. **A bare super admin can take ownership of any organisation by direct REST call (opened 11 Sep 2026, Phase 2 review; fixed in Phase 2 part B).** Verified live: policy `super_admin updates firms` is `FOR UPDATE` on `app_private.is_super_admin(auth.uid())` alone, `authenticated` holds table-level UPDATE on `public.firms` with no column grants, and the only trigger is `firms_set_updated_at`. So an aal2 super admin with no membership can set `firms.owner_user_id` to themselves — which `app_private.is_org_owner` reads as ownership, letting them then approve their own support grant (Spec §7 forbids this) — or set `is_always_free` on a client organisation (Spec §4 forbids this), leaving no audit row. Breaks invariant 3 and Spec §4. Read-only check of history: all four organisations have the same `owner_user_id`, `audit_log` holds no ownership action for any of them, and every `updated_at` matches a rename/logo/subscription edit already in the audit log — no evidence of use, and no audit trail that could prove otherwise. **CLOSED 11 Sep 2026 (Phase 2 part B).** `super_admin updates firms` was dropped; INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER were revoked from `authenticated` on `public.firms` (it now holds SELECT only); the remaining `firms` and `signup_requests` policies were re-targeted from role `public` to `authenticated`; and `public.set_firm_always_free(_firm_id, _value, _reason)` is now the only path to the flag — aal2 + super admin, a reason of 3+ characters, an audit row, and TRUE permitted only on the practice organisation recorded in `app_private.platform_settings`. New posture check `always_free` reports an Action if any other organisation carries the flag. Residual: `authenticated` still holds MAINTAIN on `public.firms` (VACUUM/ANALYZE only, no row access) — cleaned up with the Phase 7 grant sweep (item 24).

28. **Bare super-admin and support-grant writes to `client_subscriptions` were unaudited — CLOSED 11 Sep 2026 (Phase 3b).** `super admins manage client subscriptions` (`FOR ALL` on `is_super_admin`) was dropped and INSERT/UPDATE/DELETE/TRUNCATE revoked from `authenticated`, which now holds SELECT only. Comps, trials and dashboard-tier changes go through aal2 SECURITY DEFINER functions that require a reason and write their own audit row: `public.set_client_comp`, `public.set_client_trial` (both super admin only) and `public.set_client_dashboard_tier` (client write access or super admin). Stripe webhook writes stay service_role (system context) and are recorded by the generic trigger below.

29. **Path C writes left no audit trail — CLOSED 11 Sep 2026 (Phase 3b).** One generic `AFTER INSERT OR UPDATE OR DELETE` trigger, `public.audit_table_change()` (SECURITY DEFINER, `SET search_path`), now writes an `audit_log` row per row change recording the actor (`auth.uid()`, null for system contexts), the table, the row id, the operation and the changed columns old → new. Attached to `user_roles`, `plan_levels`, `signup_requests`, `xero_assessment_contact`, `client_subscriptions`, `subscriptions` and `firms`; it replaces the insert/delete-only `audit_user_roles_change`. Where an audited definer function already writes a richer row, both rows appear — that is intended. The PGlite suite asserts the trigger exists on all seven tables for all three operations, and that an update writes a row naming the changed columns.

30. **A super admin could self-join any organisation — CLOSED 11 Sep 2026 (Phase 3b).** `adminSetSelfFirmMembership` upserted a `firm_members` row through `supabaseAdmin` for any organisation. It now calls `public.admin_set_self_firm_membership(_firm_id, _join)` through `context.supabase`: aal2 + super admin, joining permitted only while `firms.owner_user_id` still holds `super_admin` (a handed-over organisation is refused with "This organisation has been handed over. Ask the owner for an invite, or request support access."), the row inserted or reactivated as `status='active'` with the previous status recorded, and every join and leave audited. Leaving remains self-only. All four current organisations are super-admin-owned, so no legitimate access changed.

31. **`set_firm_always_free` could fail open — CLOSED 11 Sep 2026 (Phase 3b).** It compared `_firm_id <> app_private.practice_firm_id()`, so a missing practice setting made the comparison NULL and let TRUE through on any organisation; it also recorded a fixed UI reason. It now refuses outright when `practice_firm_id()` is null, compares with `IS DISTINCT FROM`, and stores the reason the caller supplies (3–500 characters, validated in the server function and in the subscription editor, which asks for it only when the flag actually changes). The `always_free` posture check reports an Action when the practice organisation has not been recorded.


**Backlog 18 — CLOSED 11 Sep 2026 (Phase 3a).** The read/write split now exists in the database:
`app_private.user_can_write_client` (client owner or active membership, never a support grant) is the
write helper, wrapped for server code by aal2-guarded `public.user_can_write_client` and
`public.user_can_write_firm`; `app_private.user_can_manage_client` is documented as the READ helper and
is used by read policies only. `app_private.move_xero_file_to_client` uses the write helper, the
support-grant write policy on `client_subscriptions` (`staff manage client subscriptions`) was dropped,
and every server-function write path calls a database write check. The `support_write` posture check
was rewritten to scan all permissive write policies and every writing SECURITY DEFINER function
(comments stripped); it reports zero support-admitting write paths.

**Backlog 32 — CLOSED 11 Sep 2026 (Phase 3a).** Confirmed live before the fix: `branding.server.ts`
authorised branding writes with `platformStaffCanAccessFirm`, which admits a support grant, and
`clearClientLogo` wrote no audit row. Branding writes now call `public.user_can_write_firm` /
`public.user_can_write_client`; branding reads still allow a grant; clearing a client logo writes a
`client_logo_cleared` audit row.

**Backlog 25 — mostly closed 11 Sep 2026 (Phase 3a).** An active support grant may now read `clients`
and `client_statutory_accounts` through two new SELECT policies (owner approved). `report_cache` and
`scenario_exclusions` were deliberately left unchanged and remain deny.

**Backlog 18, partial result (recorded 11 Sep 2026, Phase 2 matrix run) — superseded by the entry above.** The RLS half is no longer reproducible: the nine tables that used to carry `FOR ALL` policies built on `app_private.user_can_manage_client` now carry per-command policies whose write halves use membership-only `EXISTS` checks, and the matrix suite proves an active support grant is denied insert, update and delete on all of them. What remains of item 18 is the shared gate itself — `app_private.user_can_manage_client` still admits `is_super_admin AND platform_staff_can_access_firm` — reachable through `app_private.move_xero_file_to_client` and the server-function write path. Those rows stay marked as known failures and are proved by the live suite in Phase 2 part 3. Item 18 is NOT closed.





### Follow-up — profile names and posture accuracy (11 Sep 2026)

Authenticated profile writes are column-restricted to `display_name`; INSERT and table-level UPDATE were revoked. New profiles no longer default the name to email. Admin name changes run through an aal2, super-admin database function and append `profile_name_changed`. Presence grants were reduced to no anonymous privileges and exactly SELECT/INSERT/UPDATE for authenticated users. The audit append-only posture check now counts only permissive public/authenticated write policies and checks actual INSERT/UPDATE/DELETE/TRUNCATE privileges. Verified account email is sourced from `auth.users` for identity lookups, online presence, and admin people lists.

1. **`SECURITY DEFINER` functions — full triage done 7 Sep 2026, item stays open for two decisions.** All 70 definer functions in `public` and `app_private` were read line by line: 46 in `public`, 24 in `app_private`; 48 are EXECUTE-able by `authenticated` (was 49 before this pass). Fixed this pass: `public.client_allowed_widgets` gained the same caller guard its siblings already carry, and `app_private.get_tier_widgets` had EXECUTE revoked (no caller anywhere). Everything else is either guarded, super-admin-only, or unreachable by a signed-in session (no EXECUTE). Two triaged findings remain open and are listed as items 18 and 19; the linter warning class itself is by design — these functions are callable and refuse internally.

2. ~~Two dead ALL-command policies on `xero_connections`~~ — **closed 6 Sep 2026**, see Closed above.
3. ~~`xero_oauth_states` policy targets `PUBLIC`~~ — **closed 6 Sep 2026**, see Closed above.
4. **Path B audit rows.** `logXeroRead()` records `meta.access_path` on live Xero calls only (`api.server.ts:401`, `:504`), and skips it when `conn.firm_id` is null. Reads served from stored data write no audit row at all: `snapshot-read.server.ts`, `verdicts.functions.ts`, `client_reports`, `reconciliation_snapshots`, `report_cache`, `audit_findings`, and `search.functions.ts` — the last being the widget built specifically for support-grant holders.
5. **`loan-consolidation.functions.ts:178`** selects `tenant_id, tenant_name` for every connection in the database via `supabaseAdmin`, unfiltered by organisation. Callers filter afterwards; no leak to a response was confirmed.
6. **`tier_settings`** has rows for `advisory` and `basic` only — `investigate` and `multi_company` have no kill switch. `investigate` is in the enum but has no plan row; decide whether it is retired.
7. **DRTABT Projects has 12 clients on `multi` (limit 10)** — no more until raised or overridden.
8. **3 super_admin accounts**, all Positive Traction. Confirm each is needed and MFA-enforced. Outside the codebase.
9. **GST treatment undecided** — TODO in `billing-checkout.functions.ts`. Do not guess.
10. **`sandbox_exec`** (Lovable platform role, not application code) holds `SELECT, INSERT` on `xero_connections` including both token columns, and has `rolbypassrls`. Raise with Lovable; cannot be fixed from here.
11. **Connection status is not verified against Xero.** The app treats a row as connected based on the account-level refresh token, which is shared across all of a user's organisations and says nothing about any single one. If a client revokes access at their end, the app will not notice and will keep presenting the file as connected. Discovered 6 Sep 2026 via a stale record ("Hay Officesmart Newsagency") that Xero had not listed as connected for an unknown period; the row was removed the same day.
12. **`disconnectXero` sends the wrong identifier to Xero.** It passes the local row `uuid` to `DELETE /connections/{id}`, which expects the Xero connection id — a value the schema does not store. Xero returns 404, which the code swallows as success, so the remote connection is probably never removed. Affects every client offboarding. Fixing needs a new column to store Xero's connection id.
13. **Revocation is account-wide, not per organisation.** All of a user's connections share one refresh token, so revoking to remove one organisation would disconnect all of them. `disconnectXero` has no guard against this. Revocation should only ever be used when removing a user's last connection.
14. **Orphaned connections recur.** The OAuth callback stamps `firm_id` only for tenants it considers new, so an organisation already in `known_tenant_ids` is re-upserted unstamped on every reconnect. `disconnectOrphanXeroConnection` discards tokens locally without revoking, which removes any means of a proper removal later.

15. **`admin.functions.ts:116` lists organisation members without `status`.** Deliberately left: it is a display list on the admin organisation page, not a gate, and filtering would hide suspended/removed members from the very screen used to manage them. Decide whether the UI should show status instead.
16. **`invites.functions.ts:446` inserts a `firm_members` row on invite acceptance without setting `status`,** relying on the column default. Left alone: it is a write, not a check, and setting it explicitly is more than a filter. Confirm the column default is `active` and make it explicit.
17. **`subscription-state.server.ts` treats a null `status` as active** (`!row.status || row.status === "active"`). Left alone: the column is NOT NULL today, so the branch is dead, but removing it is a logic change, not a filter.

18. **Support grants can write — partially closed 7 Sep 2026.** `public.set_client_widget_enabled` and `public.delete_client_report` no longer call `app_private.user_can_manage_client`; both now inline the membership-only rule already used by `public.set_client_tier_widgets` and `public.assert_client_write_access` (caller owns the client, or `app_private.has_firm_access` on the client's organisation). No live grant existed at the time (`firm_support_access`: 0 granted, unrevoked, unexpired), so nothing changed in practice. **Still open:** `app_private.user_can_manage_client` itself still admits `is_super_admin AND platform_staff_can_access_firm`, and 14 RLS policies plus `app_private.move_xero_file_to_client` and `app_private.user_can_read_client` depend on it. Nine of those policies are `FOR ALL`, so a support grant can still write to `client_access`, `client_cost_classifications`, `client_notes`, `client_true_breakeven_inputs`, `client_xero_orgs`, `loan_consolidation_accounts`, `tier_widget_config`, `unreconciled_lines` and `unreconciled_uploads`, and `app_private.move_xero_file_to_client` is a write. Deciding the rule for the shared gate is the remaining work.
19. **Bulk dashboard tiers — closed 7 Sep 2026.** `public.set_all_client_tiers` now gates on `app_private.is_super_admin(auth.uid())` instead of `app_private.has_firm_access`; every other line (plan `allowed_tiers` check, rows written, audit row) is unchanged. All 12 active `firm_members` rows belong to users who hold `super_admin`, so no current behaviour changed. **Related, unchanged and reported to the owner:** `setClientDashboardTier` (`src/lib/billing.functions.ts`) writes `client_subscriptions.dashboard_tier` through the caller's session, gated by the `staff manage client subscriptions` RLS policy (`platform_staff_can_access_firm`) or `super admins manage client subscriptions`. That path is *not* super-admin only and also admits a live support grant; a decision is pending.
20. **Awaiting owner decision (raised 11 Sep 2026, with the Phase 1 MFA change).** (a) Should the two aal1 server functions `logAuthEvent` and `logLogin` be timeboxed or additionally rate limited? A Xero-minted aal1 session can call both; they only write audit/login rows and return `{ok:true}`. (b) One of the three super admins has no verified TOTP factor; after this change no aal1 session reaches any data, so that account enrols at next sign-in via `/auth/mfa-enroll` (Supabase Auth only, unaffected by the new guards). Confirm this is understood before it next signs in. (c) The tier/plan configuration tables were left outside the aal2 policy pending the separate tier-catalogue decision.

## Phase 2 — Guardrails (started 11 Sep 2026)

Phase 2 proves the access model; it fixes no access rule. Delivered so far:

- `docs/security/access-matrix.ts` — the authoritative role × resource × operation matrix, every row
  citing its rule. `docs/security/access-matrix.md` is generated from it and a test fails if it is
  stale, so the readable document and the tests cannot disagree. Includes the expired grant, revoked
  grant, super-admin self-approval and organisation-A-owner-reads-organisation-B cases.
- `docs/security/server-fn-aal1-allowlist.ts` — the two approved aal1 loggers and the seven
  unauthenticated server functions, each with a reason and what contains it.
- `docs/security/admin-client-register.md` — every one of the 58 files using `supabaseAdmin`,
  verified by reading the call path, not labelled. Rule 7 violations are recorded as known failures
  under backlog item 21. `src/lib/notes-access.server.ts` left the register in Phase 3a: it no longer
  uses `supabaseAdmin` at all, it calls `public.user_can_write_client`.
- `tests/static-guards.test.ts` — fails the build on a server function without `requireAal2`, an
  unregistered `supabaseAdmin` use, a new `profiles.email` read, a non-literal middleware list, or a
  `tenantId` read from a request.
- `public.security_test_runs` plus `public.record_access_test_run()` (aal2 + super admin, no writes
  from a browser session), and an `access_tests` posture check (Action on unexpected failures or a
  stale fixture fingerprint, Warn if never run or older than 7 days).
- `definer_guards` tightened: it now requires `assert_aal2`/`is_aal2` specifically instead of any
  caller mention. Verified after the change: 30 callable definer functions scanned,
  0 without the guard, `xero_required_scopes` excluded (constant list).
- `bun run security:check` runs the matrix staleness check and the whole vitest suite.

Not yet built (next in this phase): the PGlite fixture's full auth mirror (`auth.uid()`, `auth.jwt()`,
`auth.users`, `auth.mfa_factors`, role grants, BYPASSRLS definer owners) with the aal1 meta test, the
matrix-driven PGlite suite, the live smoke suite with its isolated "ZZ Security Test Org" and
per-role test accounts, and the "Run access tests" button on `/admin/security`.

## Phase 1b — Security posture card (done 11 Sep 2026, corrected same day)

A compact **Security** card sits directly under the sidebar navigation: shield icon, an
**All OK / Warn / Action** pill, the line `N OK · N Warn · N Action · N online`, "Checked X min
ago", online chips (green shield = verified second factor, red shield = none; tooltip carries
name, role, factor status and last active time), a refresh button and a **View details** button
to `/admin/security`. Above six people online it shows six and "+N more"; `/admin/security` lists
everyone with the same indicators. Collapsed, it is the shield alone with a tooltip carrying the
same counts.

**Corrections applied 11 Sep 2026:**
- The presence heartbeat moved to the `_authenticated` layout, so every signed-in aal2 person is
  recorded — owners, staff and client viewers, not only super admins on admin pages. It pauses
  while the tab is hidden and resumes on focus. Reading presence stays super-admin + aal2 via
  `public.online_users()`.
- `last_seen_at` can no longer be forged: a BEFORE INSERT OR UPDATE trigger
  (`public.set_presence_seen_at`) overwrites it with `now()`. Verified — an insert of
  `now() + 10 days` stored the server time instead.
- Dropped checks restored into the same list: `token_enc_key` (real AES-256-GCM round trip on the
  server), `xero_pkce` (recent `xero_oauth_states` rows must carry a 43+ character code verifier;
  17 rows in 90 days, 0 without), `tls_hsts` (server HEADs the public origin and reads
  `strict-transport-security`; otherwise Warn "not verified"), and `hibp` (Warn — not verified,
  confirm in the backend authentication settings). Server-only checks are merged into the single
  `getSecurityChecks` result, so the sidebar and `/admin/security` still show identical counts.
- `definer_guards` now states in its evidence that it is a text heuristic and is not proof the
  guard runs on every path, and returns the guard name matched per function for the details view
  (28 callable definer functions, 0 unmatched).

Every status is computed at request time by `public.security_posture()` — SECURITY DEFINER,
`SET search_path = ''`, whose first two statements are `app_private.assert_aal2()` and
`app_private.me_is_super_admin()`. Nothing is hard-coded; each of the 14 checks returns its own
evidence string. `/admin/security` renders the same function's output, so the two surfaces cannot
drift. Presence lives in `public.user_presence` (user id + last seen only); RLS lets a person read
and write their own row only, plus the restrictive aal2 guard, and the card reads other users
through `public.online_users()` under the same super-admin + aal2 guard. No Realtime publication
was added.

Two checks currently report **Action** honestly: `support_write` (backlog item 18 —
`app_private.user_can_manage_client` still admits a support grant) and `user_mfa`/`admin_mfa`
depending on enrolment. Verified: with an aal1 session both new functions return
`42501 MFA_REQUIRED`; anonymously `permission denied for function security_posture`.

## Deliberate exceptions and pending decisions (owner-decided 9 Sep 2026)

- **`setClientXeroAllowance` super-admin escalation — DELIBERATE EXCEPTION to invariant 3, do not "fix".** In `src/lib/clients.functions.ts`, a super admin updates `clients.max_xero_orgs` through `supabaseAdmin` after the membership path fails. This is by decision, not oversight: the only write policy on `clients` is `app_private.is_firm_owner`, and two of the three Positive Traction staff hold `role='staff'` (not owner) in three of the four organisations — removing the escalation would lock them out of setting a client's Xero file allowance, which they need. **Known consequence:** any super admin can change the allowance on any organisation, including one they are not a member of. Acceptable while every super admin is Positive Traction staff; **revisit before any outside firm is onboarded.**
- **`plan-tiers.server.ts:55` — awaiting owner decision.** `assertTierInPlanForClient` lets a super admin set a dashboard tier outside the organisation's plan. Unresolved whether that is a legitimate entitlement override or an invariant-3 bypass.
- **Tier catalogue (`plan_levels`, `tier_settings`) readable by any signed-in user — assessed 9 Sep 2026, left as-is.** `plan_levels_read` is `USING (true)` for `authenticated`; `tier_settings` read is the same. Exposed: plan/tier keys, labels, descriptions, client/Xero limits, `allowed_tiers`, widget lists, `is_free`. Not exposed: no pricing (lives in Stripe), and nothing about which organisation or client is on which plan (that requires `subscriptions`/`client_subscriptions`, separately gated). The client dashboard reads the dashboard-scope rows for tier labels and the settings tier list, so locking it down would break rendering for every client viewer; the exposure is configuration, not another organisation's data. Revisit if a per-organisation column is ever added to these tables.

## Standing caution

This list records what has been looked at, not what exists. Absence from it is not evidence of safety.

## Xero scope availability (recorded 8 Sep 2026)

**`accounting.journals.read` is NOT available to this app.** It does not appear on the app's entitled scope list; Xero rejects the authorise request with `invalid_scope` when it is included. Do not request it again. Any period-derived figure (e.g. PAYG withheld from journal lines) must come from payroll scopes (`payroll.payruns.read`, `payroll.payslip.read`, `payroll.employees.read`, `payroll.settings.read` — added 8 Sep 2026) or from transaction data, never from `Journals`. This cost two failed attempts on 8 Sep 2026 (one live outage of the connect flow) before being established.
