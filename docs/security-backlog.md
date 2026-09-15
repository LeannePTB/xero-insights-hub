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

- **Daily 3am sign-in cut-off — REMOVED, 15 Sep 2026 (owner decision). CLOSED.** Introduced 14 Sep 2026, removed a day later. Reason recorded by the owner: the 30 minute inactivity timeout addresses the stolen-device threat directly, while a daily forced sign-in added friction for everyone without covering it (and was mistaken for a sign-in fault). Removed in one change across every layer: `app_private.is_session_fresh()` dropped (verified beforehand that only `is_aal2`, `assert_aal2` and `session_controls_posture` referenced it — no policy, trigger or cron job did), the freshness term removed from `app_private.is_aal2()`, the `SESSION_EXPIRED` branch removed from `app_private.assert_aal2()`, `dailySignInMiddleware` removed from `src/start.ts`, the `_authenticated` gate and `/auth` staleness sign-outs removed, the `ta:signin-at` and `ta:signin-expired` hints and their helpers (`dailySignInCutoff`, `isTokenStale`, `isSessionStale`, `markSignInNow`, `clearSignInMark`, `markSignInExpired`, `takeSignInExpired`) deleted, the "Daily sign-in required" copy and the 3am wording on Settings → Account removed, and the `stale_session_member` matrix role and its rows removed. `public.session_controls_posture()` now reports the inactivity window only and additionally **asserts the removal is complete** (no `is_session_fresh` reference and no such function), so it cannot read OK for a control that no longer exists. **The inactivity timeout was deliberately left entirely intact** — `session_activity`, `touch_session_activity`, `session_is_active`, the 30 minute window, the 29 minute warning, the cross-tab deadline, the request-layer idle check and the distinct `SESSION_IDLE` code are unchanged, and every idle matrix row still passes. No access rule changed and MFA enforcement was not touched.

## Open

- **New-table grants rule.** Every new `public` table must explicitly revoke default privileges from `anon` and grant only the minimum privileges each allowed role needs; RLS is not a substitute for grant hygiene.
- **Names are not collected by every public invite/signup path.** Leave `profiles.display_name` null when no real name was supplied; add name collection in a separate reviewed change.
- **Display names are not identity.** A person can choose the same display name as someone else. Online tooltips and admin people lists must always pair the display name with the verified email from `auth.users`, never `profiles.email`.

21. **Authorisation is re-implemented in TypeScript before `supabaseAdmin` — systemic rule 7 violation (opened 11 Sep 2026, Phase 2 audit; fix in Phase 4). CLOSED 11 Sep 2026, Phase 4 batch 5.** Verified by reading each call path and recorded per file in `docs/security/admin-client-register.md`. The dominant pattern before a `supabaseAdmin` call is a hand-rolled check against `user_roles` / `firm_members` / `client_access` / `client_xero_orgs` rather than a database authorisation function (`user_can_access_firm`, `user_can_access_client`, `assert_client_write_access`, `client_entitlement`). The main offenders are `src/lib/xero/access.server.ts` (`assertWidgetAccess`, the dashboard gate every Xero widget inherits), `src/lib/widget-access.server.ts`, `src/lib/loan-consolidation.functions.ts` (`canManageClient`/`canReadClient`), `src/lib/clients.functions.ts`, `src/lib/xero/client-orgs.server.ts`, and six separate local copies of `assertSuperAdmin` (`admin`, `advisors`, `billing`, `firms`, `invites`, `security`, `xero/orphan-connections`). A typo in any one copy silently opens that surface. Sixteen further files use `supabaseAdmin` on paths this audit could not trace end to end; they are recorded fail-closed as `unverified` in the register and must be individually verified in Phase 4. **Phase 4 batch 1 (11 Sep 2026) — partly closed:** the Xero read gate and everything authorising through it now hold no rule in TypeScript. `public.effective_tier_for_tenant`, `public.assert_widget_access`, `public.client_for_tenant`, `public.user_can_access_tenant`, `public.assert_tenant_belongs_to_client` and `public.user_can_write_client_scenario` are caller-scoped (`auth.uid()`) and aal2-guarded; `client_for_tenant` raises on an ambiguous Xero file rather than guessing. Converted and now guarded by `docs/security/converted-files.ts` + static guard 6: `xero/access.server.ts`, `tenant-ownership.server.ts`, `widget-access.server.ts`, `xero/scenario|consolidated|audit|receivables|payables|reports|cashflow|org-basis|file-capability|snapshot-compare|snapshot-refresh|accounts.functions.ts`, `xero/recon-snapshot.server.ts`, `cost-classification.functions.ts`, `statutory-accounts.functions.ts`. The remaining files stay a known failure for batches 2–5. **Checked and rejected as claims:** `getAuditAnomalies`/`exportAuditLogCsv`/`getRetentionStatus` and `listLoginEvents` do gate on a role first — the gate is TypeScript, not an open endpoint. **Phase 4 batch 2 (11 Sep 2026) — further closed:** client data reads and writes now decide nothing in TypeScript. New caller-scoped, aal2-guarded, `SET search_path` functions with EXECUTE revoked from PUBLIC/anon: `public.me_is_super_admin`, `me_has_role`, `my_firm_ids`, `user_can_read_client`, `client_viewers`, `grant_client_access`, `set_client_access_tier`, `revoke_client_access`, `client_for_access`, `client_access_tiers`. Converted and guarded: `clients.functions.ts`, `loan-consolidation.functions.ts`, `consolidation-groups.functions.ts`, `loan-autosetup|loan-recon|loan-mismatch.server.ts`. Verified but not in the ordering guard because `supabaseAdmin` is imported at module level: `xero/client-orgs.server.ts`, `xero/onboard.server.ts`. `xero/connections.functions.ts` stays a known failure for a later batch — its first service-role write is the unauthenticated "Sign in with Xero" OAuth-state insert (system context). Batches 3–5 outstanding. **Phase 4 batch 3 (11 Sep 2026) — further closed:** super admin / Path C. All nine local `assertSuperAdmin` copies and the local `assertAdvisor` copy are deleted; the rule now has one implementation, `public.assert_super_admin()` / `public.assert_advisor()`, with thin wrappers in `src/lib/auth/super-admin.server.ts`. New caller-scoped, aal2-guarded, `SET search_path` functions, EXECUTE revoked from PUBLIC/anon: `assert_super_admin`, `assert_advisor`, `admin_list_advisors`, `admin_advisor_user_ids`, `admin_set_super_admin`, `admin_grant_advisor`, `admin_remove_advisor`, `organisation_members`, `admin_firm_members`, `plan_level_usage_count`. The last-super-admin, no-self-demotion and last-advisor rules moved into the database with them. Converted and guarded: `admin`, `advisors`, `firms`, `security`, `plan-levels`, `tier-config`, `ownership`, `xero/orphan-connections`, `xero-assessment`, `audit`. `ownership.functions.ts` left the register entirely (no service role left). `invites.functions.ts` is verified but stays out of the ordering guard: after the super-admin check it provisions an organisation with the service role, and the same file holds the pre-session invite acceptance (system context). Batches 4–5 outstanding. **Phase 4 batch 3 (11 Sep 2026) — further closed:** super admin / Path C. All nine local `assertSuperAdmin` copies and the local `assertAdvisor` copy are deleted; the rule now has one implementation, `public.assert_super_admin()` / `public.assert_advisor()`, with thin wrappers in `src/lib/auth/super-admin.server.ts`. New caller-scoped, aal2-guarded, `SET search_path` functions, EXECUTE revoked from PUBLIC/anon: `assert_super_admin`, `assert_advisor`, `admin_list_advisors`, `admin_advisor_user_ids`, `admin_set_super_admin`, `admin_grant_advisor`, `admin_remove_advisor`, `organisation_members`, `admin_firm_members`, `plan_level_usage_count`. The last-super-admin, no-self-demotion and last-advisor rules moved into the database with them. Converted and guarded: `admin`, `advisors`, `firms`, `security`, `plan-levels`, `tier-config`, `ownership`, `xero/orphan-connections`, `xero-assessment`, `audit`. `ownership.functions.ts` left the register entirely (no service role left). `invites.functions.ts` is verified but stays out of the ordering guard: after the super-admin check it provisions an organisation with the service role, and the same file holds the pre-session invite acceptance (system context). Batches 4–5 outstanding. **Evidence:** every remaining `supabaseAdmin` site in `src/` is now either a registered system context or authorises through a caller-scoped aal2 database function first; `docs/security/admin-client-register.md` contains no `KNOWN FAILURE` row, and the static guard reports zero rule 7 violations. The build-blocking guard (`tests/static-guards.test.ts` guard 6) now fails on any converted entry point that reaches `supabaseAdmin` without a registered database authorisation call, on any direct read of `user_roles`, `firm_members`, `client_access` or `firm_support_access` in a converted file, and on any converted helper module reachable from an unconverted entry point.
22. **`profiles.email` is still read as a display fallback (opened 11 Sep 2026, partly closed 11 Sep 2026 in Phase 4 batch 4).** Originally six sites. The three report sites (`reports/monthly-report.server.ts`, `reports/monthly-report-context.server.ts`, `reports/report-verdict.server.ts`) are FIXED: a report byline and a note author are now the stored display name only, with "Positive Traction" / "Unknown" as the fallback, so no sign-in email can reach a client-facing report. Still open in three sites — `clients.functions.ts`, `support-access.functions.ts`, `xero/orphan-connections.functions.ts` — where the verified email must come from `auth.users`. `tests/static-guards.test.ts` reports the remaining three and fails on any new occurrence. **CLOSED 11 Sep 2026, Phase 4 batch 5:** the remaining fallbacks (client note authors, orphan Xero connections, support access, login events) are gone. Identity and recipients come from `auth.users`; the display fallback is `display_name` only. The static guard now fails the build on ANY `profiles.email` read — the known-failure list is empty.
23. **Delete the template endpoint (opened 11 Sep 2026).** `src/lib/api/example.functions.ts` exposes an unauthenticated `getGreeting`. It touches no data, but it should not ship. **CLOSED 11 Sep 2026, Phase 4 batch 5:** `src/lib/api/example.functions.ts` deleted and its aal1 allow-list entry removed.

51. **Nobody was recording activity in the published app (opened and closed 15 Sep 2026).** No `session_activity` row existed for any real signed-in session, so the inactivity check was resolving every session from its sign-in time alone — meaning a person was refused everything exactly 30 minutes after signing in, however busy they were, and with no warning shown by a browser running older cached code. Verified live: the post-MFA access token does carry `session_id` (claims `aal,amr,app_metadata,aud,email,exp,iat,is_anonymous,iss,phone,role,session_id,sub,user_metadata`), a brand-new session with no activity row is accepted through the `auth.sessions` start-time fallback, `public.touch_session_activity()` writes the row, and a real browser sign-in through the sign-in screen wrote its first activity row one second after the second factor. Fixed the browser call shape (`touch({})`, previously `{ data: undefined }`), made a SESSION_IDLE answer end the session instead of being swallowed, and stopped `/auth` offering back an aal2 session the server has already refused (it now signs it out and shows the sign-in form with the inactivity message). Regression rows added for the just-completed-MFA case. No access rule, no MFA enforcement and no database object changed. **Enforcement re-enabled 15 Sep 2026, 04:50 UTC (owner decision), after all four proofs held** — see spec § 0c "Enforcement history": the activity term is back in `app_private.is_aal2()`, `app_private.assert_aal2()` raises `SESSION_IDLE` before `MFA_REQUIRED`, and `ENFORCE_INACTIVITY_AT_REQUEST_LAYER` is `true`. The missing positive assertion is now a permanent test (`active_session_member`), closing the gap that let this ship.

24. **Excess default grants on `public` tables (opened 11 Sep 2026, Phase 2; clean up in Phase 7).** Supabase grants `anon`/`authenticated` ALL privileges on every new table, so most tables still carry INSERT/UPDATE/DELETE/TRUNCATE for `authenticated` with no permissive policy for that command, and some carry privileges for `anon`. RLS denies the writes today, so this is grant hygiene rather than a live hole — the same mistake fixed on `user_presence` and `security_test_runs`. The new `excess_grants` check in `public.security_posture()` lists the affected tables and commands on every run. Do not re-grade its Warn/Action results before the cleanup lands.

25. **An active support grant cannot read four of the client tables (opened 11 Sep 2026, Phase 2 matrix run).** Proved in the PGlite matrix suite: the read policies on `clients`, `client_statutory_accounts`, `report_cache` and `scenario_exclusions` do not name `app_private.platform_staff_can_access_firm`, so a holder of a valid Path B grant sees nothing on those tables — including the client list, which makes the grant close to unusable. This fails closed (Spec §0.8), so it is a gap, not an incident. Decide with the owner whether Path B is meant to cover the client list before changing any policy; nothing was changed in Phase 2.

26. **An organisation cannot read its own audit rows (opened 11 Sep 2026, Phase 2 matrix run).** Spec §3 says an organisation sees its own `audit_log` rows; the only read policy on `audit_log` is `app_private.is_super_admin(auth.uid())`, so an organisation owner reads none. Fails closed. Either implement the organisation-scoped read policy or amend the spec.

27. **Standing client-viewer grants and owner-managed invites — design approved, NOT scheduled (recorded 11 Sep 2026).** Owner-approved redesign in `docs/design/people-and-access.md`. Introduces a standing grant covering every client in an organisation, specific per-client grants that override it, and owner-invited client viewers. Must be added as a named access path to the Access Control Spec §2 before building, with matrix rows for: standing grant sees newly added client; specific grant overrides standing; client entitlement caps the level; revoking standing leaves specific grants; standing grant never confers write access; standing grant never crosses organisations. Build only after Phases 4–7 are complete because it changes the client read path that Phase 4 is consolidating. Withdraws the earlier "merge members and viewers into one People section" request.

28. **A bare super admin can take ownership of any organisation by direct REST call (opened 11 Sep 2026, Phase 2 review; fixed in Phase 2 part B).** Verified live: policy `super_admin updates firms` is `FOR UPDATE` on `app_private.is_super_admin(auth.uid())` alone, `authenticated` holds table-level UPDATE on `public.firms` with no column grants, and the only trigger is `firms_set_updated_at`. So an aal2 super admin with no membership can set `firms.owner_user_id` to themselves — which `app_private.is_org_owner` reads as ownership, letting them then approve their own support grant (Spec §7 forbids this) — or set `is_always_free` on a client organisation (Spec §4 forbids this), leaving no audit row. Breaks invariant 3 and Spec §4. Read-only check of history: all four organisations have the same `owner_user_id`, `audit_log` holds no ownership action for any of them, and every `updated_at` matches a rename/logo/subscription edit already in the audit log — no evidence of use, and no audit trail that could prove otherwise. **CLOSED 11 Sep 2026 (Phase 2 part B).** `super_admin updates firms` was dropped; INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER were revoked from `authenticated` on `public.firms` (it now holds SELECT only); the remaining `firms` and `signup_requests` policies were re-targeted from role `public` to `authenticated`; and `public.set_firm_always_free(_firm_id, _value, _reason)` is now the only path to the flag — aal2 + super admin, a reason of 3+ characters, an audit row, and TRUE permitted only on the practice organisation recorded in `app_private.platform_settings`. New posture check `always_free` reports an Action if any other organisation carries the flag. Residual: `authenticated` still holds MAINTAIN on `public.firms` (VACUUM/ANALYZE only, no row access) — cleaned up with the Phase 7 grant sweep (item 24).

29. **Bare super-admin and support-grant writes to `client_subscriptions` were unaudited — CLOSED 11 Sep 2026 (Phase 3b).** `super admins manage client subscriptions` (`FOR ALL` on `is_super_admin`) was dropped and INSERT/UPDATE/DELETE/TRUNCATE revoked from `authenticated`, which now holds SELECT only. Comps, trials and dashboard-tier changes go through aal2 SECURITY DEFINER functions that require a reason and write their own audit row: `public.set_client_comp`, `public.set_client_trial` (both super admin only) and `public.set_client_dashboard_tier` (client write access or super admin). Stripe webhook writes stay service_role (system context) and are recorded by the generic trigger below.

30. **Path C writes left no audit trail — CLOSED 11 Sep 2026 (Phase 3b).** One generic `AFTER INSERT OR UPDATE OR DELETE` trigger, `public.audit_table_change()` (SECURITY DEFINER, `SET search_path`), now writes an `audit_log` row per row change recording the actor (`auth.uid()`, null for system contexts), the table, the row id, the operation and the changed columns old → new. Attached to `user_roles`, `plan_levels`, `signup_requests`, `xero_assessment_contact`, `client_subscriptions`, `subscriptions` and `firms`; it replaces the insert/delete-only `audit_user_roles_change`. Where an audited definer function already writes a richer row, both rows appear — that is intended. The PGlite suite asserts the trigger exists on all seven tables for all three operations, and that an update writes a row naming the changed columns.

31. **A super admin could self-join any organisation — CLOSED 11 Sep 2026 (Phase 3b).** `adminSetSelfFirmMembership` upserted a `firm_members` row through `supabaseAdmin` for any organisation. It now calls `public.admin_set_self_firm_membership(_firm_id, _join)` through `context.supabase`: aal2 + super admin, joining permitted only while `firms.owner_user_id` still holds `super_admin` (a handed-over organisation is refused with "This organisation has been handed over. Ask the owner for an invite, or request support access."), the row inserted or reactivated as `status='active'` with the previous status recorded, and every join and leave audited. Leaving remains self-only. All four current organisations are super-admin-owned, so no legitimate access changed.

32. **`set_firm_always_free` could fail open — CLOSED 11 Sep 2026 (Phase 3b).** It compared `_firm_id <> app_private.practice_firm_id()`, so a missing practice setting made the comparison NULL and let TRUE through on any organisation; it also recorded a fixed UI reason. It now refuses outright when `practice_firm_id()` is null, compares with `IS DISTINCT FROM`, and stores the reason the caller supplies (3–500 characters, validated in the server function and in the subscription editor, which asks for it only when the flag actually changes). The `always_free` posture check reports an Action when the practice organisation has not been recorded.

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
4. **Path B audit rows.** `logXeroRead()` records `meta.access_path` on live Xero calls only (`api.server.ts:401`, `:504`), and skips it when `conn.firm_id` is null. Reads served from stored data write no audit row at all: `snapshot-read.server.ts`, `verdicts.functions.ts`, `client_reports`, `reconciliation_snapshots`, `report_cache`, `audit_findings`, and `search.functions.ts` — the last being the widget built specifically for support-grant holders. **CLOSED 12 Sep 2026, Phase 6.** One writer, `logClientDataRead()` in `src/lib/audit.server.ts`, records every read of a client's figures: live Xero calls, stored Xero snapshots (`snapshot-read.server.ts`), stored reconciliation snapshots (`recon-snapshot.server.ts`), stored monthly reports, saved group loan snapshots and the public report link. Each row carries the actor, client, organisation, Xero file, a short stable read key, the source (`live` / `snapshot` / `cache` / `report` / `report_link`), the period and `meta.access_path` from `public.firm_access_path`; it carries no figures, account names, contact names, tokens, IPs or user agents. Identical reads collapse to one row per actor + client + Xero file + key + source per five minutes. Drift is caught by static guard 7 and by the `read_audit` posture check (`public.read_audit_posture()`), which compares recorded reads against figures actually served. `report_cache`, `audit_findings` and `verdicts` were re-checked and return no ledger figures of their own.
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
19. **Bulk dashboard tiers — closed 7 Sep 2026.** `public.set_all_client_tiers` now gates on `app_private.is_super_admin(auth.uid())` instead of `app_private.has_firm_access`; every other line (plan `allowed_tiers` check, rows written, audit row) is unchanged. All 12 active `firm_members` rows belong to users who hold `super_admin`, so no current behaviour changed. **Related, unchanged and reported to the owner:** `setClientDashboardTier` (`src/lib/billing.functions.ts`) writes `client_subscriptions.dashboard_tier` through the caller's session, gated by the `staff manage client subscriptions` RLS policy (`platform_staff_can_access_firm`) or `super admins manage client subscriptions`. That path is _not_ super-admin only and also admits a live support grant; a decision is pending.
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

## Phase 5 steps 1–4 — Xero connection lifecycle (done 11 Sep 2026)

- Disconnect revokes at Xero first and fails closed; the row is marked
  `disconnected` instead of deleted, so `client_xero_orgs` (ON DELETE CASCADE)
  keeps the client-to-Xero-file link and a later reconnect restores the same
  file to the same client. Success and failure both write an audit row.
- Who may disconnect is decided in the database by
  `public.user_can_disconnect_xero_connection` — membership or client-write
  only. A support grant, a client viewer, another organisation's member and a
  bare super admin are all refused.
- A disconnected Xero file no longer counts toward the client's Xero file
  limit: `app_private.client_xero_files_used` is shared by both client
  allowance triggers and by `getClientOrgAllowance` via
  `public.client_xero_files_used`.
- Reconnect updates only the reconnecting person's row; a person reconnecting a
  file a colleague authorised gets their own row rather than overwriting the
  colleague's tokens.
- Token refresh: only a definitive `invalid_grant` marks rows disconnected
  (`grant_revoked`). Transient failures change no status, and a successful
  refresh never revives a row disconnected on purpose.

## Phase 5 step 5 — orphan prevention at the source (done 12 Sep 2026)

- `xero_connections.firm_id` is now `NOT NULL`. Verified read-only first: 12
  rows, 0 with a null organisation, 0 whose linked client belongs to a
  different organisation. No existing row was modified.
- Deferred constraint triggers (`client_xero_orgs_firm_match`,
  `xero_connections_firm_match`) refuse a link whose client belongs to a
  different organisation from the connection. Deferred so
  `app_private.move_xero_file_to_client` can relink and restamp in one
  transaction.
- The connect/onboard callback no longer stores an unassigned row when the
  plan-limit trigger refuses a tenant. Every row is stamped with the
  organisation that already owns the file, otherwise the one the flow was
  started for; a tenant with neither is refused. Refusals are audited
  (`xero_file_refused`) and reported to the user using the database's own
  `PLAN_LIMIT_XERO_ORGS` wording.
- `detachXeroOrg` no longer clears `firm_id` on unlink. A connection keeps the
  organisation it was authorised for; moving a file between organisations
  stays a platform-admin action (`move_xero_file_to_client`).
- The unassigned-connections card stays as a read-only-in-practice view of
  legacy rows; nothing can create a new one.

## Phase 7 batch 1 — excess default grants trimmed (done 12 Sep 2026)

Backlog 24 **CLOSED**. One atomic migration reduced `anon`/`authenticated` table privileges
to the intersection of what was already held and what a permissive policy for that command
actually admits. Before/after dump: `docs/security/grant-dump-phase7.md`.

- `authenticated` TRUNCATE: 47 tables → 0. REFERENCES/TRIGGER/MAINTAIN → 0.
- Authenticated privileges removed entirely from the system-only tables
  `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`,
  `rate_limit_buckets`, `security_contact_details` (every permissive policy there is
  service-role-only or an explicit deny) and from `xero_connections` at table level —
  only the 13 non-token column grants remain.
- `anon` held nothing before and holds nothing after.
- Purely reductive, so no row can turn from deny into allow. Proved by identical
  matrix totals: 1,287 rows, 1,222 proved, 0 failed, 0 known failures, 40 tests passed,
  fingerprint MATCH `50b6584f…`.

Found during the dump, not fixed here:

34. **A table-level SELECT grant on `access_invites` still covers `token_hash` (opened 12 Sep 2026).**
    The column grants on the eight non-token columns are correct, but the table-level SELECT
    grant supersedes them, so an organisation owner reading their own invite rows through
    PostgREST can also read the hash. The hash is not the token and cannot be replayed, so
    this is hygiene, not an incident. Fixing it means dropping the table-level SELECT and
    relying on column grants alone, which changes PostgREST behaviour for `select=*` —
    needs its own change with matrix coverage, not a grant tweak inside batch 1.

35. **`report_cache` is granted but unused (opened 12 Sep 2026).** No application code reads or
    writes it; it is kept only because the access matrix has rows for it. Candidate for removal
    in Phase 7 batch 2 alongside the dead-function review, with matrix rows retired in the
    same change.

## Phase 7 batch 2 — the definer register (done 12 Sep 2026)

`docs/security/definer-register.md` is now GENERATED by `scripts/definer-register.ts` from the
live catalogue (names, arguments, EXECUTE grants, `SET search_path`, the aal2 assertion in the
body) plus a code search of `src`, `tests`, `scripts`, plus every other function body, every
policy and every trigger. Plain-English purposes live in `docs/security/definer-purposes.ts`.
`bun run security:check` runs it with `--check`: a new or changed definer function that is
missing from the register, or that has no stated purpose, fails the check. Generated mirrors
(`tests/fixtures/rls-schema.sql`, `scripts/dump-rls-fixture.sql`) and the generated
`src/integrations/supabase/types.ts` are deliberately not counted as callers, so a dead
function cannot look live.

Totals: **127** definer functions (96 `public`, 31 `app_private`); **97** callable by signed-in
users, 73 of which assert aal2 in the body; 0 without `SET search_path`; **5** with no caller found.
The 24 callable functions without a body-level aal2 assertion are 23 `app_private` helpers and
trigger functions (not a signed-in call path; the tables they guard carry the restrictive
`mfa_aal2_required` policy) plus the approved exception `public.xero_required_scopes()`.

Stated limitation: PostgREST request logs cannot be read from here, so "no caller found" means
no reference in this repository, in any function body, in any policy or in any trigger — not
proof that nothing external calls it. Scheduled (pg_cron) callers cannot be read by the dump
role either; the one that matters (`purge_expired_security_logs`, daily 03:17) was verified once
with an administrative connection and is recorded in `definer-purposes.ts`.

**Nothing was removed this turn.**

- `public.firm_has_consolidation(uuid)` — proposed candidate, proved **LIVE**, kept: called by the
  bodies of `public.firm_allowed_widgets` and `public.firm_subscription_state`. (Zero references in
  `src`/`tests`/`scripts` and none from a policy or trigger, so a code search alone would have been
  wrong here.)
- `public.record_access_test_run(...)` — no caller found, **kept by owner decision** for the slim
  live smoke suite approved for after Phase 7.

36. **Four definer functions have no caller found (opened 12 Sep 2026, Phase 7 batch 2).** Not removed,
    because removal was scoped to the one named candidate and each needs its own reviewed change:
    `public.audit_user_roles_change()` (no trigger anywhere in the database uses it — the generic
    `audit_change` trigger on `public.user_roles` runs `audit_table_change()` instead, so this looks
    superseded), and `app_private.get_tier_widgets(uuid, dashboard_tier)`,
    `app_private.get_user_firm_id(uuid)`, `app_private.get_user_tier(uuid, text)` — no reference in
    code, in any other function body, in any policy or in any trigger. Each still carries
    `SET search_path`, so none is a live hole; this is surface to retire.

37. **The legacy aliases `public.user_can_access_client(uuid, uuid)` and
    `public.user_can_access_firm(uuid, uuid)` are NOT dead (opened 12 Sep 2026).** They are superseded in
    intent by the read/write pairs, but the register shows real callers in `src`
    (`billing-checkout`, `branding.server`, `clients`, `consolidation-groups`, `loan-consolidation`,
    reports and others). Retiring them means moving each caller to
    `user_can_read_client`/`user_can_write_client` and `user_can_write_firm` first, which changes
    behaviour where a read caller currently accepts a support grant. Owner's instruction stands: this
    is its own change, not part of Phase 7 batch 2.

38. **CLOSED 12 Sep 2026 (Phase 7 batch 4 part A) — a revoked Xero token's ciphertext stayed on the row
    until the next authorisation (opened 12 Sep 2026, Phase 7 batch 3).** Disconnect already revoked the
    grant at Xero first and failed closed, but `src/lib/xero/connections.functions.ts` updated only
    `status`, `disconnected_at` and `disconnected_reason`, leaving `access_token_enc` and
    `refresh_token_enc` in place until a reconnect overwrote them.
    Fixed: both columns are now nulled in the SAME update that marks the row, in every path where the
    grant is dead — advisor disconnect (`connections.functions.ts`, `disconnected_by_advisor`),
    a refresh token Xero itself rejects (`api.server.ts`, `invalid_grant` → `grant_revoked`), and the
    unassigned-connection cleanup (`orphan-connections.functions.ts`, which already did so). The row and
    the `client_xero_orgs` link are still kept, and the callback upserts fresh tokens onto the same row
    on `user_id,tenant_id`, so a reconnect restores the same file to the same client.
    Deliberately NOT cleared: the nightly authorisation reconcile (`authorised-tenants.server.ts`,
    `not_authorised`). That token is still valid for the other Xero files on the same consent, and the
    reconcile restores such a row to `connected` without any re-authorisation — clearing it would break
    that recovery and force an unnecessary consent. Wording corrected to "revoked at Xero and removed"
    in `data-retention.md`, `data-hosting.md` and `README.md`; matrix row added.
    No back-fill was needed: all 12 live connections were `connected` at the time of the fix, so no row
    was holding a revoked token. This is a forward fix.

39. **Xero assessment evidence gaps — artefacts that do not exist (opened 12 Sep 2026, Phase 7 batch 3).**
    None of these is an access-control defect; each is a document or record an assessor will ask to
    see. Full detail, question by question, in `docs/security/xero-assessment-inputs.md`.
    **Documents created 12 Sep 2026 (no action performed yet):**
    (a) and (b) — rotation procedure and secret inventory now in `docs/security/key-and-secret-rotation.md`;
    (c) — incident register and security-contact procedure now in `docs/security/incident-register.md`;
    (d) — remediation SLA and scan/pen-test record now in `docs/security/vulnerability-records.md`;
    (e) **residency part CLOSED 12 Sep 2026:** region confirmed Singapore and decision recorded in
    `docs/security/data-residency-decision.md`; backup/restore procedure now in
    `docs/security/backup-and-restore.md`;
    (f) — security contact procedure now in `docs/security/incident-register.md`;
    (g) — periodic access-review procedure now in `docs/security/access-review.md`.
    **Still open — owner actions required, not documents:**
    (a)/(b) first rotation not performed and secret list not confirmed against Project Settings → Secrets;
    (c) no drill performed and no incident has been recorded;
    (d) no retained scan output and no penetration test commissioned;
    (e) no retained platform attestations (SOC 2 / ISO) and no tested restore with an RPO/RTO;
    (f) **page-published part CLOSED 13 Sep 2026:** `/security` page live and linked from the
    public sign-in page, `/.well-known/security.txt` (RFC 9116) served as `text/plain`, and the
    `security@` → `admin@` alias confirmed live — recorded in `incident-register.md`;
    (g) first access review not performed and signed off.
    **Mechanism now exists (12 Sep 2026):** `public.security_attestations` +
    `public.record_security_attestation` (spec §17) records a dated, named,
    audited human confirmation for a control no system can read. Wired to
    `leaked_password` only so far; (c) incident drill, (g) access review, the
    tested restore in (e) and the rotation records in (a)/(b) can each be added
    to the attestable list as they are actually done. Attestation is evidence
    that a person checked, never a substitute for a machine-readable check.

40. **CLOSED 12 Sep 2026 (final hygiene batch).** `email_unsubscribe_tokens.token_hash` replaces
    `token` (column dropped in the same migration; the single existing row was converted to
    `encode(digest(token,'sha256'),'hex')` so its outstanding link still works — `select count(*)` was
    1 row, 1 unused). `src/routes/email/unsubscribe.ts` now looks up `.eq('token_hash', hashToken(token))`
    on GET and POST, selects only the columns it needs instead of `*`, and calls
    `enforceRateLimit('unsubscribe_get|post:<ip>', 30, 300)` before touching the database (429 on limit).
    Minting moved to hash-at-rest in `src/lib/email/send.server.ts` and
    `src/routes/lovable/email/transactional/send.ts`: each send mints a fresh token and upserts the hash
    on `email`, so the newest emailed link is the live one — a hashed token cannot be read back to reuse
    an older link. Accepted consequence, recorded deliberately: an unsubscribe link in an older email to
    the same address stops working once a newer email is sent; the newest email always carries a working
    link, and suppression itself is unaffected. Original finding:
    **Unsubscribe links are not rate limited and their token is stored in the clear (opened 12 Sep 2026,
    Phase 7 batch 4 re-audit).** `src/routes/email/unsubscribe.ts` looks a token up directly
    (`.eq('token', token)`, lines 33-36 and 96-99) with no `enforceRateLimit` call anywhere in the file
    (`rg -c "enforceRateLimit" src/routes/email/unsubscribe.ts` → none), and
    `src/lib/email/send.server.ts:60-73` stores the generated token as plaintext in
    `email_unsubscribe_tokens.token`, unlike invite and report tokens, which are stored hashed.
    Impact is limited: the only thing the token does is suppress that one email address, the update is
    atomic and single-use, and `anon`/`authenticated` hold no privileges on the table (verified: `anon`
    has zero grants in `public`). Fix: hash the token like the others, and rate limit the route by IP.

41. **CLOSED 12 Sep 2026 (final hygiene batch).** One revoke migration; `proacl` on all three is now
    `{postgres=X/postgres}` (was `NULL`, i.e. EXECUTE to PUBLIC). The triggers are still attached and
    enabled — `trg_enforce_client_limit` on `clients`, `trg_enforce_xero_org_limit` and
    `trg_enforce_xero_org_limit_on_move` on `xero_connections`, all `tgenabled = 'O'` — and a trigger runs
    as the table owner, not the caller, so `PLAN_LIMIT_CLIENTS` / `PLAN_LIMIT_XERO_ORGS` still fire. The
    definer register's "callable by signed-in users" count fell from 97 to 94 as a result. Original
    finding: **Three `app_private` trigger functions still hold EXECUTE for `PUBLIC` (opened 12 Sep 2026,
    Phase 7 batch 4 re-audit).** `app_private.enforce_client_limit`, `enforce_xero_org_limit` and
    `enforce_xero_org_limit_on_move` return true for `has_function_privilege('anon', oid, 'execute')`;
    every other definer function has EXECUTE revoked. Not exploitable — Postgres refuses to call a
    trigger function directly ("trigger functions can only be called as triggers") and all three carry
    `SET search_path` — but the project rule says revoke EXECUTE from PUBLIC and `anon` on every definer
    function, so this is a hygiene gap. Fix: one revoke migration.

42. **CLOSED 12 Sep 2026 (final hygiene batch).** Real count re-verified live before starting: **34**
    policies with `polroles = '{0}'`, not 46 (the earlier figure counted policies rather than distinct
    `polroles = '{0}'` rows after Batch 1). Fixed with `ALTER POLICY ... TO <role>` (no drop/recreate, so
    there was never a window with no policy): 9 on the four system email tables to `service_role`
    (`email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`) and 25 to
    `authenticated`. Live check after: `polroles = '{0}'` count is **0**. Matrix re-proved after each
    migration: 1222 proved, 0 failed, identical both times. Original finding:
    **46 policies have no explicit `TO` clause (opened 12 Sep 2026, Phase 7 batch 4 re-audit).**
    `pg_policy.polroles = '{0}'` (PUBLIC) on 46 permissive policies across `clients`, `firm_members`,
    `billing_events`, `client_notes`, `subscriptions`, the email tables and others, so each applies to
    every role rather than to `authenticated` (or `service_role`) explicitly. Not currently reachable by
    `anon`: `anon` holds no table privileges in `public` (verified live), and the RESTRICTIVE
    `mfa_aal2_required` guard is on 51 of 53 tables. Fix: recreate each policy with an explicit `TO`
    role; do it table by table, proving the matrix unchanged at each step.

43. **CLOSED 12 Sep 2026 (final hygiene batch).** Real count re-verified live: **20** permissive
    `FOR ALL` policies in `public`, not eight, and every one had a non-null `WITH CHECK`, so the split was
    mechanical. One migration recreated each as four per-command policies — SELECT/DELETE carrying the
    original `USING`, INSERT the original `WITH CHECK`, UPDATE both — generated from the live catalogue
    itself so no expression could be retyped wrongly, and raising an exception rather than guessing if a
    policy had no role or a missing expression. The 51 RESTRICTIVE `mfa_aal2_required` guards stay
    `FOR ALL` (they only narrow). Live after: permissive `FOR ALL` count **0**, total policies 238 (was
    178), `polroles = '{0}'` still 0. Matrix identical: 1222 proved, 0 failed. One static guard needed its
    allow-list updated for the renamed `rate_limit_buckets service only` policy (four per-command names,
    still `service_role`-only). Original finding:
    **Eight legacy permissive `FOR ALL` policies remain on data tables (opened 12 Sep 2026,
    Phase 7 batch 4 re-audit).** `audit_finding_snoozes`, `client_statutory_accounts`,
    `consolidation_group_members`, `consolidation_groups`, `dashboard_card_order`,
    `loan_consolidation_snapshots`, `scenario_exclusions` and `xero_oauth_states` (plus the super-admin
    write policies on `user_roles` and `xero_assessment_contact`). Each qual was read: they resolve to
    `app_private.has_firm_access` (active membership only), `app_private.has_client_access`,
    `user_id = auth.uid()` or `app_private.me_is_super_admin()` — none admits a support grant, so no
    access is over-granted today. The defect is shape, not scope: rule 1 wants per-command policies so a
    future edit cannot widen reads and writes together. Fix: split into per-command policies.

## 44. Revoking a specific grant while a standing grant exists can mislead the owner (opened 12 Sep 2026)

Path D means a person can hold both a standing grant and a specific grant on the same client. Revoking the specific grant leaves the standing grant in force, so the client is still visible while the screen suggests access was removed. The database behaviour is correct and proved by a matrix row; the **wording and remedy are owed by the UI**: the revoke confirmation must say the person will still see the client through their "every client" grant, and offer the only real remedy — switch them to "only the clients I tick" with that client unticked. No exclusion row type. **CLOSED 12 Sep 2026 (Batch 4).** The specific-grant revoke confirmation now detects the standing grant, says plainly that the person will still see the client, and the only action offered is switching them to a named list of clients with that one left out (`switchStandingToSelected` → specific grants first, standing grant revoked last, so a failure leaves the wider access rather than none). No exclusion row type was added.

## 45. Hosting region is Singapore — decision RECORDED 12 Sep 2026; disclosure actions still open

The database is confirmed as Supabase managed PostgreSQL 17.6.1.127 in **Asia Pacific (Singapore)** — checked against the backend on 12 Sep 2026. Lovable Cloud offers only Americas / Europe / Asia Pacific with no country-level choice, and the region cannot be changed after creation. **Decision made and recorded in `docs/security/data-residency-decision.md`: remain on Singapore and disclose it, rather than migrate** — no Australian option exists on the platform at any price, and migration would mean a separate self-managed Supabase project, not a toggle. **Still open:** adding the disclosure wording (which lives in that file) to the privacy policy and to client terms / the engagement letter — both `[CONFIRM: date]` in the record — and confirming with a privacy adviser whether the Australian Privacy Principles, in particular APP 8 on cross-border disclosure, apply to the practice. Note plainly: payroll data means **employees' personal information** is involved, not just the client's own books, and the legal question is for a **professional adviser**, not for this project's documentation.

## 46. `security.txt` `Expires:` must be refreshed annually (opened 13 Sep 2026)

RFC 9116 treats a stale `security.txt` as invalid. The file at `public/.well-known/security.txt` carries `Expires: 2027-09-13T00:00:00.000Z` (12 months from its creation on 13 Sep 2026). Before that date the file must be re-issued with a fresh `Expires` roughly 12 months out, and this item rolled forward. There is no mechanism that reminds anyone — the calendar reminder belongs to the owner.

## 47. No product path to delete a non-advisor account (opened 13 Sep 2026, from the first access review)

The only account-deletion path is `revokeAdvisor` on the advisors page, and the advisors list shows `advisor` role holders only. The dormant `leanne@astrovisual.com.au` account (a leftover `client_viewer` role, since revoked through the audited function on 13 Sep 2026) cannot be reached by that screen, so its auth login cannot be deleted from the product. The account reaches nothing: no role, membership, grant, or practice-team row. Remedy owed: either extend the advisors-page removal to any account a super admin selects, or a deliberately narrow audited delete path for fully-dormant accounts. Until then, deletion of this login is a manual service-role operation the owner performs deliberately, not a workaround.

## People and access redesign — Batch 5 (done 12 Sep 2026)

The one deliberate widening in the security programme, and its boundary.

**Before:** only a holder of the `advisor` role could invite a client viewer (`inviteClientViewer` read the role in TypeScript). An organisation's own owner could not.

**After:** `inviteClientViewer` reads no role. It asks the database one question — `public.me_can_manage_client_viewers(client)`, which is `app_private.can_manage_viewers_for_client(auth.uid(), client)` — and that answers true only for the client's own organisation OWNER, or for a person on `practice_team` who holds an ACTIVE `firm_members` row for THAT organisation. Everything else is unchanged and denied: organisation staff (they read the viewer list, they cannot change it), support-grant holders (PK 5, read-only), a super admin who is neither a member nor practice team (PK 3), another organisation's owner (PK 4), viewers themselves, and any aal1 session (PK 2).

Objects touched, all in Batch 3/4 or here: `app_private.can_manage_viewers_for_client`, `public.me_can_manage_client_viewers`, `public.grant_client_access` / `set_client_access_tier` / `revoke_client_access`, the `client_access` INSERT/UPDATE/DELETE policies, and `src/lib/clients.functions.ts::inviteClientViewer`. No read path widened; no organisation-level or platform data is reachable through any of it.

**Practice team.** `practice_team` (super-admin managed, aal2, audited, service-role writes only, readable by platform admins only) already existed from Batch 2. Added here: `public.admin_practice_team()`, `admin_add_practice_member(uuid)`, `admin_remove_practice_member(uuid)` — each asserts aal2 and super admin, audits, EXECUTE revoked from `PUBLIC`/`anon`; a super-admin control on the advisors page (`/settings/advisors`) — originally its own screen at `/settings/practice-team`, folded in on 12 Sep 2026 so the practice team and the advisors list cannot drift; that path now redirects; and auto-add inside `adminCreateOrganisation`'s existing all-or-nothing block, one audit row each. An empty practice team is normal: organisation creation still succeeds with the creator as owner and only member. `admin_set_self_firm_membership` and its handed-over restriction (backlog 30) are UNCHANGED — verified by reading the live function definition: joining still requires the organisation's owner to hold `super_admin`, so a practice-team member still cannot join a handed-over organisation.

**Proof:** 1,444 matrix rows, 1,378 proved here, 0 failures, 0 known failures, 44 tests, fixture fingerprint `628888f09775a063d7877a8abe92e88434c7950be478ae9946dc8e74c87f92fc`. New rows cover owner allow / staff-support-superadmin-viewer-anon deny on viewer management, an owner denied on another organisation's client, a practice-team member of organisation A denied management in organisation B, and `practice_team` readable by platform admins only with every write denied. Backlog 44 closed by the revoke-trap wording in Batch 3/4.

## Member removal — 12 Sep 2026

Closed the last handover gap. `public.remove_firm_member(_firm_id, _user_id)` is
the only removal path: aal2-guarded, caller-scoped (`auth.uid()`), row-locked,
`SET search_path`, EXECUTE revoked from `PUBLIC`/`anon`, audited as
`firm_member_removed`. Owner removes staff of their own organisation (including a
Traction Advisory person); anyone but the owner may remove themselves; the owner
is refused and pointed at ownership transfer; the last active member cannot be
removed. Soft removal only (`status = 'removed'`). No support grant, staff
member, unrelated super admin or other organisation's owner can reach it.
Verified, not assumed: every membership test and the plan-limit counter are
already active-only, so no path counts a removed row. Spec §15, 17 matrix rows,
1,461 rows / 1,395 proved / 0 failures, fingerprint `a760e424…`.

## Slim live smoke suite (12 Sep 2026) — the parked item, built at reduced scope

Built exactly the reduced scope: three accounts, **no super-admin test account**,
**one owner-added secret** (`SECURITY_TEST_TRIGGER_SECRET`), no test-vs-real
plumbing on real tables. Spec §16 has the detail. New objects: `firms.is_test`;
service-role-only `security_test_accounts` and `security_test_run_state`;
`app_private.is_security_test_account`, `app_private.security_test_firm_id`,
`app_private.confine_security_test_accounts()` (triggers on seven tables);
`public.test_accounts_posture()`. `admin_firm_overview` (still
`security_invoker`), `online_users()` and `security_posture()` now exclude test
identities. Code: `src/lib/live-access-tests.server.ts`, `src/lib/totp.server.ts`,
`src/lib/live-access-tests.functions.ts`,
`src/routes/api/public/security/run-access-tests.ts`,
`scripts/run-live-access-tests.ts` (wired into `security:check`, SKIPS with a
message when the secret is absent). Registered: admin-client register row for the
runner, unauthenticated allow-list entry for the route, four definer purposes.
Matrix: 11 new rows (1,472 rows, 1,395 proved here, 0 failures, 0 known
failures); the two service-role-only tables added to the documented
`USING (true)` allow-list in `tests/rls-isolation.test.ts` on the same footing as
`rate_limit_buckets` (no browser role holds a grant). No existing row changed.

Still open: the first live run has not happened — it needs the owner to add
`SECURITY_TEST_TRIGGER_SECRET` in Project Settings → Secrets and the app to be
published. Backlog 39 (non-code assessment evidence) is unchanged.

## 48. Business owner self-service and External adviser terminology (opened 13 Sep 2026)

**OPEN — batches 3 to 6.** Project Knowledge section 2 was amended on 13 September
2026 with Path D (External adviser, read-only) and Path E (Business owner,
self-service on one specific client), plus invariant 11 (a read predicate is never
a write or billing grant). Batch 1 (rules and terminology) is DONE: user-facing
wording, screen labels, matrix role labels, spec §18 and the design note. No
policy, grant, function or access rule changed in Batch 1.

Outstanding, in order, each its own security change:

- **Batch 2 — relationship foundation: CLOSED 13 Sep 2026.** Nullable enum-backed `client_access.relationship`
  (`business_owner` / `external_adviser`, `NULL` = Not set, read-only) plus the same on
  `access_invites`; audited aal2 caller-scoped assignment function; relationship carried
  through `grant_client_access`, `client_viewers`, `my_client_access` and
  `apply_viewer_invite`; **unconditional** closure of direct writes to `client_access`
  (revoke authenticated INSERT/UPDATE/DELETE, drop those write policies, route every screen
  through the audited functions). No unique constraint on `(client_id)` for
  `business_owner` — a client may have several business owners. Optional display-only inviter
  labels are carried through grants and invites; the verified email remains identity. The People
  screen asks relationship before scope, shows Business owner / External adviser / Not set, and
  uses selected-client counts or All clients badges. No Business owner self-service was enabled.
  **Presentation follow-up closed 13 Sep 2026:** People now sits in organisation settings after
  Xero files and before ownership/support controls. The old People route redirects to that section;
  all application links point there. Active membership remains the visibility boundary, and the
  existing audited functions remain the only implementation.
- **Batch 3 regression fixed 13 Sep 2026.** Dropping the `scenario_exclusions` write policies left no write path for members or client owners; per-command member write policies plus a member SELECT policy were re-created, the scenario server functions moved off the admin client, and the matrix gained the 8 positive member/client-owner rows that would have caught it.
- **Batch 3 — remove the accidental External adviser writes. DONE 13 Sep 2026.** The three
  permissive `scenario_exclusions` write policies were dropped (writes already went through the
  audited server functions, so no member write was moved to a direct REST path);
  `public.user_can_write_client_scenario` now returns `app_private.user_can_write_client` only;
  the `unreconciled_lines` viewer comment UPDATE policy was replaced by "Members update comments
  for their client" on `user_can_write_client`. `enforce_unreconciled_line_viewer_columns` is kept
  and verified live (trigger attached, BEFORE UPDATE, enabled; body still raises for any column
  other than `client_comment`). Read predicates in write policies: 4 → 0, now enforced by static
  guard 11 across write policies, write helpers and billing helpers.
- **Batch 4 — Business owner self-service:** dashboard cards, break-even inputs, statement
  uploads and comments, scenario exclusions, and Xero connections bound to that exact client.
- **Batch 5 — client-scoped billing**, behind a separate payment-readiness gate
  (webhook verification, replay, initial checkout event, GST, price catalogue).
- **Batch 6 — proof and closure:** matrix rows including two business owners on one client,
  the membership-governs handover case, cross-client and cross-organisation denials, and the
  direct-write closure; fixtures, generated docs, posture, linter and the Security report.
- **Monitoring findings fixed 13 Sep 2026 (5 of 5).**
  1. *Xero file allowance leaked from access grants (high).* `getClientOrgAllowance` read
     `public.client_access_tiers`, so any Business owner / External adviser grant (which carries a
     pass-through `multi_company` dashboard level) raised the client's Xero file allowance to 5.
     The allowance now derives from the client's own `client_subscriptions.dashboard_tier`, with
     always-free organisations entitled to every level. The database triggers
     (`enforce_client_xero_org_allowance`, `enforce_client_max_xero_orgs`) remain the enforcement
     point; this path can only report, never widen. Caller IDs stay filters (invariant 4).
  2. *Disconnecting a Xero file left other rows connected (high).* `disconnectXero` marked only the
     picked row. It now marks every `xero_connections` row for that `tenant_id` within the same
     `firm_id` — revoke at Xero first, fail closed, mark rather than delete, keep the client link,
     clear token ciphertext (unchanged). Another organisation's rows are untouched.
  3. *`client_xero_files_used` called a non-existent two-argument function (high).* Redefined to
     call `app_private.user_can_read_client(auth.uid(), _client_id)`; caller-scoped, aal2 path and
     `SET search_path` unchanged.
  4. *Unsubscribe links in older emails stopped working (medium).* The unique constraint on
     `email_unsubscribe_tokens.email` was dropped (plain index kept, `token_hash` stays unique) and
     both send paths now insert one token row per send. Only hashes are stored; the used-token
     safety fallback still refuses to send when the address unsubscribed via any earlier link.
  5. *Owner invite option always failed (medium).* The Owner choice was removed from the admin
     organisation invite dialog; invitations to an existing organisation are staff only, matching
     `adminInviteFirmMember`. Ownership still changes only via `transfer_organisation_ownership`.
  Verified this turn: fixture fingerprint match (255 policies), access matrix up to date, definer
  register regenerated (153 functions), 50 tests passed, live access suite 18 passed / 0 failed /
  0 inconclusive, typecheck clean. Supabase linter unchanged at the 90 accepted signed-in
  SECURITY DEFINER warnings.

## Daily 3am sign-in cut-off and missing sign-out (done 14 Sep 2026)

Owner requirement: everyone must sign in again after 3am Australia/Sydney each day, and
several pages offered no way to sign out at all.

Enforced in the database, which is the only enforcement point (invariant 6). New
`app_private.is_session_fresh()` (SECURITY DEFINER, `SET search_path`, `EXECUTE` revoked from
`PUBLIC`, registered in `definer-register.md`) compares the session's `auth.sessions.created_at`
against the most recent 3am Sydney; system and `service_role` contexts pass, and a missing
`session_id` claim or unknown session row is treated as stale (fail closed). `app_private.is_aal2()`
now requires it, so the RESTRICTIVE `mfa_aal2_required` policy on every data table hides all rows
from a stale session; `app_private.assert_aal2()` raises `SESSION_EXPIRED` before the MFA check.
The request middleware in `src/start.ts` and the `_authenticated` browser gate can only deny
earlier — neither is relied upon. Sign-out is now reachable everywhere: the shared `useSignOut`
hook, `AppHeader`, a floating `GlobalSignOut` on the routes with no header, and on `/auth` for an
already signed-in visitor.

No policy, grant or predicate changed who may see what once signed in fresh; the only change to
who can read existing rows is that a session left open past 3am Sydney reads nothing until the
person signs in again, which is the requirement.

Verified this turn: fixture regenerated and fingerprint MATCH (255 policies,
`b10fcea6…`), access matrix rendered and `--check` up to date, 1,560 rows / 1,483 proved / 0 failures (four new rows, all proved: stale session denied
on client data, `assert_aal2()` denied with a stale session and with no `session_id` claim, fresh
session unchanged), definer register regenerated (155 functions, `--check` OK), 54 tests passed,
typecheck clean. Supabase linter: 91 warnings, all the one accepted category (signed-in-executable
SECURITY DEFINER) — the +1 is `app_private.is_session_fresh()`.

## Optional personal video on a monthly management report (done 14 Sep 2026)

Owner requirement: a platform super admin may attach a Loom link to a DRAFT monthly report;
everyone who can already see that report sees the player, and it must never appear in the PDF.

Five nullable columns added to `client_reports` (`video_url`, `video_heading`, `video_message`,
`video_set_by`, `video_set_at`). No RLS policy, grant or predicate changed: who may read or change
a report is exactly as before, and the new columns travel with the row they belong to.

The one write path is `setReportVideo` (`report-video.functions.ts` → `report-video.server.ts`)
behind `requireAal2`, with BOTH gates required and neither standing in for the other:
`assert_super_admin()` in the database, then `canWriteFirm` → `public.user_can_write_firm` on the
`firm_id` read server-side from the stored report row. A super admin who is not an active member of
that organisation is refused (invariant 3), and a support grant is refused (invariant 5). Only a
draft may be changed; a supplied URL is rejected unless it parses as a `loom.com` share/embed id, so
the embed `src` is always a Loom URL. The write itself uses the service role because
`client_reports` has no write policy — registered in `admin-client-register.md`. The audit row
(`client_report_video_set` / `client_report_video_cleared`) carries client, period and version and
never the URL.

The video lives OUTSIDE the frozen payload, so `MONTHLY_REPORT_PAYLOAD_VERSION` is unchanged, no
stored report becomes stale, and the PDF — which `report-pdf.server.ts` renders from an explicit
column list that does not include the video columns, plus the payload — cannot carry it. The
disclaimer, verdict page and report email templates are untouched.

## "Doesn't tie" reasons on the activity-statement card (done 14 Sep 2026)

Presentation and derived data only. The red "unexplained" chip on the GST reconciliation card is
replaced by "doesn't tie by $X" plus a plain-language reasons list (`tieReasons`) computed inside
`computeGstReconciliation` from signals already in hand: the manual-journals gap, whole-dollar
rounding on the lodged form, and ATO payments dated after period end. No new Xero calls, no new
table, policy, grant or predicate; the reasons travel through the existing `getGstReconciliation`
server function behind its existing `requireAal2` and read gate. Clients (non-advisors) see a
single client-safe note with no balances, arithmetic or transaction detail. Verified: typecheck
clean, 54/54 tests, live access 18/0/0.

## Audit honours the client's GST / PAYG settings (14 Sep 2026)

The Xero file audit's GST rules ("Income coded as BAS Excluded / No GST", both
wrong-direction tax-rate checks) fired even for a client set to "Not registered"
for GST. `runXeroAudit` now reads the client's `gst_cycle` and
`payg_withholding_cycle` under the caller's own session and passes them into the
rules: GST not registered silences the three BAS/GST tax rules, and registered
for neither GST nor PAYG withholding silences the statutory-trace rule (no
activity statement is ever lodged). Presentation/derived-data only — no new
table, policy, grant or predicate; the audit's existing requireAal2, membership
and widget gates are unchanged. Verified: typecheck clean, 54/54 tests, live
access 18/0/0.

## Report verdict honours the client's GST / PAYG settings (14 Sep 2026)

The health rules engine (R01 protected money, R05 statutory magnitude) treated a
Balance Sheet with no statutory balances as a coverage gap even for a client
registered for neither GST nor PAYG withholding — the monthly report then read
"completed in part … protected money could not be assessed" for a file where
none is expected. `evaluateFromRows` now takes `gstRegistered` /
`withholdsPayg` (undefined = unknown = registered, the historical behaviour);
when both are false, R01/R05 stay silent on an absent or GST/PAYG-only-unmatched
extraction and the lodged-and-owing split analysis is skipped entirely (no
activity statement is ever lodged). Super is never filtered out. Both callers
thread the settings read under the caller's own session: the report verdict
builder and the staff badge (`listClientVerdicts`). Presentation/derived-data
only — no new table, policy, grant or predicate. Verified: typecheck clean,
54/54 tests (four new), live access 18/0/0.

## Verdict wording per-component + closing line removed (14 Sep 2026)

Follow-up to the entry above: the settings check is now per component, not
all-or-nothing. A GST-registered client that does not withhold PAYG is never
told PAYG or super "could not be matched" — unmatched components are filtered
against what the client is expected to carry before any wording is built
(super follows PAYG withholding: no wages withheld means no super accrues).
The lodged-and-owing split analysis is still skipped only when neither GST nor
PAYG applies. Separately, the "We are available to talk this through with you
when it suits." closing line was removed from the issues verdict (owner
request; presentation only). Verified: typecheck clean, 54/54 tests (one new),
live access 18/0/0.

## All-clear verdict reworded and respects GST/PAYG registration (14 Sep 2026)

The "Nothing required attention this month" detail no longer says "We reviewed
protected money held against cash at bank, the statutory balances carried on
the Balance Sheet, and the ageing and concentration of the debtor book."
Instead, `evaluateFromRows` builds the sentence from the client's registration
settings: GST-and-PAYG-registered clients see "the money set aside for tax and
super against cash at bank, and the ageing and concentration of the debtors";
GST-only clients see only "the GST set aside against cash at bank"; PAYG-only
clients see only "the tax withheld from wages and super against cash at bank";
clients registered for neither GST nor PAYG see only the debtors clause. No
protected money is claimed when none is expected. "debtor book" replaced with
"debtors" in this sentence. Presentation/derived-data only — no new table,
policy, grant or predicate. Verified: typecheck clean, 54/54 tests (three new),
live access 18/0/0.

---

## 14 Sep 2026 — "Guarded SECURITY DEFINER functions" Action cleared, and the
## nightly cut-off lockout fixed (CLOSED)

Security-relevant. The posture check `definer_guards` reported one callable
`public` definer function with no `assert_aal2` / `is_aal2` reference:
`public.session_fresh()`. It returned a single boolean about the caller's own
session and no organisation, client or personal data, and it could not reference
the guard because the guard itself consults the freshness check. Nothing in the
app called it (the only reference was the generated types file), so it was
**dropped** rather than kept as a permanent scanner exception.
`app_private.is_session_fresh()` remains the single implementation, consulted by
`app_private.is_aal2()` and `app_private.assert_aal2()`.

While verifying it, a real defect was found in the cut-off arithmetic shared by
both functions: the cut-off was computed as today's Sydney date + 3 hours, which
between midnight and 3am local time is a *future* timestamp. In those three
hours every session was stale, so the RESTRICTIVE `mfa_aal2_required` policy
hid every row on every data table and `assert_aal2()` raised `SESSION_EXPIRED`
— signing in again did not help. `app_private.is_session_fresh()` now uses the
most recent 3am that has already passed (yesterday's when the local time is
before 3am). Fail-closed behaviour unchanged: no `session_id` claim, or no
matching `auth.sessions` row, is still stale; no request context and
`service_role` still pass. Signature unchanged, so `is_aal2()` /
`assert_aal2()` needed no edit.

No policy, grant or predicate changed. Backend linter 91 -> 90 warnings, all the
one accepted category (the -1 is the dropped function).

---

## 14 Sep 2026 — Injection review (first as its own piece of work)

Security-relevant. Audit of every injection class, with the automated check
left behind for each finding. Full coverage list: `docs/security/automated-checks.md`.

### Clean, with evidence

- **Cross-site scripting.** No `dangerouslySetInnerHTML`, `innerHTML`,
  `outerHTML`, `insertAdjacentHTML` or `document.write` anywhere in `src`
  (guard 12 now fails the build on a new one). Client names, `client_notes`,
  `unreconciled_lines.client_comment`, `source_comment`, inviter labels,
  `profiles.display_name`, organisation names and report content all render as
  JSX text. `react-markdown` is used once, on repository documentation, with
  `remark-gfm` and no `rehype-raw`, so embedded HTML is not rendered. The public
  `/report/$token` route renders the same escaped components and no raw HTML.
- **SQL.** No string-built SQL in app code (guard 12c). All 154 SECURITY DEFINER
  functions carry `SET search_path` — confirmed by catalogue query, not assumed.
  Eleven definer bodies contain `||`; each concatenates arrays, JSONB or evidence
  text and none of them EXECUTEs it. Dynamic SQL exists only in migration DO
  blocks, over catalogue names, through `format(%I)`.
- **Uploads and storage.** Logos: PNG/JPEG content-type allow-list, 2 MB cap,
  server-generated filename (`branding/organisation/<firm>/logo-<ts>.<ext>`, or
  `<client>/branding/...`), private `client-reports` bucket, read back only via a
  300-second signed URL. Nothing user-named and nothing served from an origin
  that would execute it.

### Fixed this turn

1. **Formula injection in the audit CSV export.** The old local `csvCell` escaped
   quotes, commas and newlines but not a leading `=`, `+`, `-`, `@`, tab or CR, so
   an attacker-controlled value (contact name, user agent, audit `meta`) became a
   live formula for the auditor who opened the file. One shared escaper now lives
   in `src/lib/csv.ts` and neutralises those; guard 12d forbids a second copy or a
   writer that bypasses it.
2. **Loom iframe hardening.** The validator was already sound; the frame was not
   sandboxed. It now carries `sandbox="allow-scripts allow-same-origin
   allow-presentation"`, `allow="fullscreen; picture-in-picture"` and
   `referrerPolicy="strict-origin-when-cross-origin"`. Guard 12b keeps it that way
   and forbids any other iframe.
3. **Statement upload bounds.** Added a 50,000-line cap, a 10,000-character
   per-line cap and a 20,000 parsed-line cap on top of the existing 5 MB cap, so
   malformed or hostile input fails fast instead of occupying the worker.
4. **Search term escaping.** `esc()` in `src/lib/xero/search.functions.ts` escaped
   only `"`; a trailing backslash could escape our own closing quote in the Xero
   `where` expression. Control characters and backslashes are now dropped first.
   (Term already trimmed and capped at 200 characters; dates regex-checked; paging
   clamped.)

### Opened

**48. Zod validation on server-function inputs — High, 90 days.**
65 modules use `createServerFn`; only 5 import Zod. The rest use typed
pass-through `inputValidator`s, which are compile-time only, so a hostile client
can send any shape. Every one is behind `requireAal2` and a database
authorisation call, and every id is a filter rather than a grant, which is why
this is High and not Critical. Remediate module by module, highest-value first:
`unreconciled`, `viewers`, `invites`, `billing-checkout`, `branding`,
`report-delivery`, `search`.

**49. Enforce Content-Security-Policy — Medium, 180 days.**
The live origin serves CSP in **report-only** mode with `script-src
'unsafe-inline'` (read by `curl` on `https://tractionadvisory.com.au`), so it
blocks nothing today. Move to an enforced policy and remove `unsafe-inline`
(needs a nonce or hash path through the SSR entry). The new `http_headers`
posture check reports this as Warn until then, and would report Action if the
header disappeared entirely.

### Not verified from the sandbox

The `http_headers` posture check's rendering on the Security card was not
observed this turn (it runs behind aal2 in the live app). Its inputs were
verified directly: `curl -D -` on the published origin and the custom domain
shows HSTS, nosniff, referrer-policy, `x-frame-options: DENY`,
permissions-policy and report-only CSP.

## 15 Sep 2026 — Two monitoring findings closed

- **CLOSED — Xero connection save failed with 42703.**
  `app_private.assert_xero_connection_firm_match()` resolved the connection id
  with one CASE expression referencing `NEW.xero_connection_id`; plpgsql plans
  the whole expression, so the trigger on `xero_connections` (AFTER UPDATE OF
  firm_id) raised `record "new" has no field "xero_connection_id"` and the
  callback redirected with `xero_error=db`. Rewritten with IF/ELSE so each field
  reference is parsed only in its own branch. No signature, grant, policy or
  trigger definition change; the organisation-match rule itself is unchanged and
  still fires on both tables. Verified by behaviour: `SET CONSTRAINTS ALL
  IMMEDIATE` plus a no-op `firm_id` update now succeeds. Fixture regenerated
  (255 policies, fingerprint MATCH).
- **CLOSED — client-facing GST note named the wrong cause.** The note asserted
  manual journals whatever the calculation found. `GstResult` now carries
  `tieReasonCodes` ("journals" | "rounding" | "timing") alongside the existing
  adviser wording, and the client note names only the reasons found, in the same
  order as the adviser list. Presentation and derived data only — no new Xero
  calls, no policy, grant or predicate change.

## 15 Sep 2026 — Session controls: inactivity timeout and remote sign-out

- **DONE — 30 minute inactivity timeout, enforced server-side.** Verified first
  that real sign-in tokens carry a `session_id` claim (on both aal1 and aal2
  sessions, using a contained test account that was re-banned afterwards), so the
  design keys on a claim that exists rather than an assumption.
  `public.session_activity` (server-held `last_activity_at`, no client write
  privilege), `app_private.is_session_active()` consulted by
  `app_private.is_aal2()`, `SESSION_IDLE` raised before `MFA_REQUIRED`,
  `public.touch_session_activity()` as the only writer (aal2, caller-scoped),
  `inactivityMiddleware` as a deny-only request layer, and `SessionIdleGuard` for
  the 29-minute warning with a cross-tab absolute deadline. Spec § 0c.
  **Performance:** the lookup is a primary-key hit on `session_activity_pkey`
  (index-only scan, 0.006 ms measured) and `is_session_active()`,
  `is_session_fresh()` and `is_aal2()` are all `STABLE`, so the planner evaluates
  the gate once per query rather than per row; no measurable dashboard change.
- **DONE — sign out my other devices (self-service).** `scope: "others"` proven
  to revoke server-side (204, and the revoked refresh token stops working);
  audited by `public.record_sign_out_other_devices()`.
- **DONE (50) — signing another person out remotely (stolen device).** Resolved
  15 Sep 2026 after testing every mechanism against a REAL user id on the
  contained staff test account, three live sessions open:
  - `POST /auth/v1/admin/users/{id}/logout` → 404 `404 page not found`;
    `DELETE /auth/v1/admin/users/{id}/sessions` → 404; `POST
    /auth/v1/admin/users/{id}/sessions/logout` → 404. The earlier 404
    `user_not_found` for a fake id was NOT evidence the route exists: the user
    lookup runs before routing, so a real id falls through to the router's plain
    404. Sessions still worked afterwards (access 200, refresh 200).
  - `admin.signOut(jwt, 'global')` needs the victim's own token, which an admin
    does not hold — not usable as an admin control.
  - **Ban is not a sign-out.** `ban_duration: "300s"` blocked the live session
    while it lasted (access 403, refresh 400) but did **not** delete it:
    `auth.sessions` stayed at 5 rows, and after `ban_duration: "none"` the same
    refresh token worked again (200). Shipping a brief ban as "sign out all
    devices" would have handed the stolen device its session back.
  - **An admin credential change does genuinely revoke.** After
    `updateUserById({ password })`, `auth.sessions` for that person went **5 → 0**
    and every one of the three sessions was refused (access 403, refresh 400).
  Implemented on that mechanism: `public.admin_assert_can_sign_out_user(uuid)`
  (aal2 + super admin, refuses the caller's own account, refuses the last
  remaining super admin) authorises; the server function sets a random password
  nobody holds, emails a reset link, then `public.record_sign_out_all_devices`
  writes the `sessions_revoked_all` audit row — only after the revocation
  succeeded, and never carrying a password or token. Control sits on
  Settings → Advisors per person and states the password consequence before
  confirming. No `auth`-schema write was needed and none was made.

## 15 Sep 2026 — Two posture Actions from the session-controls work (CLOSED)

Both were false positives; neither check was silenced.

- `definer_guards` flagged `public.record_sign_out_all_devices`. It was already
  guarded — its first statement calls `public.admin_assert_can_sign_out_user`,
  which asserts aal2 and super admin — but the check reads function source text
  and could not see it. Fixed honestly by adding
  `perform app_private.assert_aal2();` as its own first line (the same harmless
  duplication already applied to `admin_set_super_admin` and others), not by
  excluding the function.
- `definer_guards` also flagged `public.session_is_active()`, and `aal2_tables`
  flagged `public.session_activity`. Neither can carry the aal2 guard:
  `app_private.is_aal2()` reads that table and calls that function to decide
  whether a session is idle, so requiring aal2 of them is circular. Both are now
  documented exclusions in the same style as `xero_required_scopes`, with the
  reason printed inline in each card's evidence text. No exclusion was widened
  beyond these two names.

Verified after the change, from the live database: `session_activity` has RLS
enabled, grants nothing to `anon` (0 of 7 privileges), carries exactly one
policy — `session_activity_select_own SELECT to authenticated USING (user_id =
auth.uid())` — and `has_table_privilege('authenticated', …, 'UPDATE')` is false,
so the only write path remains `public.touch_session_activity()`. The unguarded
callable-definer count and the missing-aal2-policy table count are both 0 with
only the two named exclusions applied.

## 52. Subscriptions and dashboard cards — approved design, NOT scheduled (opened 15 Sep 2026)

Approved design recorded in `docs/design/subscriptions-and-cards.md`. The current card configuration data is self-contradictory; the cleanup is part of the rebuild, not a separate fix. **No payment system is in scope.** Build only when the product goes to market outside Positive Traction.
