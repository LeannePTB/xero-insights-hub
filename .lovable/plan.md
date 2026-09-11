# Phase 3b — super-admin powers bounded and audited

Classification: SECURITY-RELEVANT (roles, membership, RLS/grants, definer functions, billing).
Precondition met: Phase 3a finished with 0 unexpected failures, fingerprint MATCH.

## 1. Backlog 30 — self-join (`adminSetSelfFirmMembership`)
New `public.admin_set_self_firm_membership(_firm_id uuid, _join boolean)` — SECURITY DEFINER,
`SET search_path`, `assert_aal2()` + `me_is_super_admin()` first, EXECUTE revoked from public/anon.
Join allowed only while `firms.owner_user_id` holds `super_admin`; otherwise raise
"This organisation has been handed over. Ask the owner for an invite, or request support access."
Insert or reactivate the caller's own row with `status='active'`; audit row records previous status.
Leaving deletes only the caller's own row, audited. Server function calls it via `context.supabase`.
Live check: all four organisations are owned by a super admin, so no behaviour changes today.

## 2. Backlog 28 — `client_subscriptions`
Drop `super admins manage client subscriptions` (and confirm the support policy stays dropped),
revoke INSERT/UPDATE/DELETE/TRUNCATE from `authenticated`, keep SELECT.
Writes move to audited aal2 definer functions: `set_client_comp` (super admin, reason),
`set_client_trial` (super admin, reason), `set_client_dashboard_tier` (client write access or
super admin). `set_all_client_tiers` already audited. Stripe webhook writes as service_role
(system context) and is now covered by the generic audit trigger.
`subscriptions` has no write grant path for browsers already; every writer is service_role or the
audited `change_firm_plan`; the generic trigger records the rest.

## 3. Backlog 29 — one generic audit trigger
`public.audit_table_change()` (definer, `SET search_path`) writes an `audit_log` row per row change:
actor `auth.uid()` (null = system), table, row id, operation, changed columns old → new. Attached to
`user_roles`, `plan_levels`, `signup_requests`, `xero_assessment_contact`, `client_subscriptions`,
`subscriptions`, `firms`. Replaces the insert/delete-only `user_roles` trigger. Where an audited
function already writes a richer row, both rows appear — documented.

## 4. Backlog 31 — always-free
`set_firm_always_free` refuses when `app_private.practice_firm_id()` is null and compares with
`is distinct from`. Posture `always_free` reports Action when the practice setting is missing.
The subscription editor asks for a reason (3–500 chars, Zod) when the flag changes; the server
function passes it through instead of the fixed string.

## 5. Matrix, docs, fixture
Remove known failures 27–31 once proved; live-only rows keep the `live` layer with expected deny.
Add PGlite rows proving the audit trigger writes a row per covered table. Regenerate the fixture,
update the backlog and roadmap.

## Stop conditions
No current screen loses a legitimate write (staff tier changes keep working through the new
function); no Stripe behaviour change.
