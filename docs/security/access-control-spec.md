# Traction Advisory — Access Control Spec (full reference)

> Reference copy of the Project Knowledge as at 11 September 2026. Project Knowledge ("Security Rules and Change Gate") is binding and takes precedence where the two differ. Keep this file for the detailed rules below.

Xero-connected multi-tenant advisor dashboard subject to the **Xero API Consumer Security Standard**. Access control is the highest-risk area of this codebase.

If a chat request conflicts with this document, STOP and reply:
"That conflicts with the Access Control Spec, section X. Do you want to amend the spec?"

## 0. Invariants — must hold after EVERY change

1. Deny by default. Every table with organisation/client/Xero data has RLS with explicit policies.
2. No policy on a data table may read `USING (true)`.
3. **Being `super_admin` grants ZERO access to organisation or client data on its own.**
4. A `firm_id` / `client_id` / `tenant_id` from the caller is a FILTER, never a GRANT.
5. Xero OAuth tokens never leave the server. `service_role` key never reaches the browser.
6. RLS is never disabled to fix a bug. Never cache roles or grants in the JWT or localStorage.
7. **Each rule has ONE implementation, in the database.** Server code calls it, never reimplements it — including plan limits and ownership.
8. Fail closed. Showing no data is a bug; showing the wrong organisation's data is an incident.

## 1. Naming and language

**Never use "firm" in user-facing copy.** The user-facing term is **"organisation"** (matching Xero). `firm` / `firm_id` / `firms` are internal identifiers only — tables, columns, functions, RPC parameter names, TypeScript symbols, routes, query keys. Do not rename them.

- **"Company" is taken**: a *company* is an individual Xero entity belonging to a client. Hierarchy: **Organisation → Clients → Companies**.
- The `basic` tier is **"Standard"** in UI copy; do not rename the enum value.
- **Australian English**: organisation, authorise, cancelled, licence (noun). Prices in AUD.

## 2. Business model — read before designing anything

**Every client of Positive Traction gets their OWN organisation**, because the business owner needs to log in and see their own dashboard. Positive Traction super admins create and set these up as part of ongoing bookkeeping. Free by default (PTB plan); the client pays only to upgrade.

**Positive Traction owns a client organisation by default** and hands ownership over when the client is ready. After handover it stays on as `staff` so bookkeeping continues, and the client can remove it.

## 3. The three access paths — DO NOT COLLAPSE THESE

**Path A — membership.** An active `firm_members` row. How Positive Traction reaches organisations it set up and runs the books for, and how a client reaches their own. Disclosed in the member list, revocable. **Never use support access for an organisation Positive Traction set up.**

**Path B — support grant.** ONLY for an organisation Positive Traction is not a member of. Read-only, one named person, max 72h, approved by that organisation's owner.

**Path C — platform operations.** Metadata only: organisation list, plans, billing events, signup requests, invites, audit log, user roles, `admin_firm_overview`, `xero_api_errors`. MAY use bare `me_is_super_admin()`. Must never expose Xero financial data.

If a feature seems to need cross-organisation visibility, ask which path it is first.

## 4. Organisation lifecycle

**Creation** must, atomically: insert `firm_members` for the creator (`role='owner'`, `status='active'`); set `firms.owner_user_id`; insert `subscriptions` with `tier='ptb'`, `status='active'`; write an `audit_log` row. If any step fails, roll everything back. An organisation with no members and no owner is **stranded** — nobody can approve anything. This happened to "Autotek NSW" and needed manual repair.

**Never set `is_always_free` on a client organisation.** That flag is for Positive Traction's own organisation and grants the *highest enabled* tier, not Standard.

**Handover** goes only through `public.transfer_organisation_ownership(_firm_id, _new_owner_user_id, _keep_previous_as_staff default true)`: caller must be current owner, new owner must already be an active member, previous owner is demoted to `staff` or removed. Writes its own audit row. Never transfer ownership by direct UPDATE.

## 5. Plans and limits — enforced by database triggers

`plan_levels` (scope `firm`) holds `client_limit`, `xero_org_limit`, `allows_multi_org`, `is_free`, `allowed_tiers`, `enabled`. An organisation's plan is `subscriptions.tier` → `plan_levels.key`. `subscriptions.client_limit_override` wins over `client_limit`.

**`ptb` is the default for client organisations**: 1 client, 1 Xero organisation, `allowed_tiers={basic}`, free.

Triggers on `clients` and `xero_connections` block over-limit inserts and fire even for `service_role`. Catch and present these; never reimplement the check:
- `PLAN_LIMIT_CLIENTS: this organisation's plan allows N client(s). Upgrade to add more.`
- `PLAN_LIMIT_XERO_ORGS: this organisation's plan allows N Xero organisation(s). Upgrade to connect more.`

An organisation with no `subscriptions` row has NO limits — assign a plan at creation.

## 6. Authorisation functions — use these, never hand-roll

Server code (service_role bypasses RLS, so these are mandatory): `public.user_can_access_firm`, `public.user_can_access_client`, `public.client_entitlement`.

RLS policies use `app_private.*`: `has_firm_access`, `is_org_owner`, `is_firm_owner`, `has_client_access`, `user_can_manage_client`, `firm_support_access_active`, `platform_staff_can_access_firm`, `user_can_access_tenant`, `firm_limits`.

Pattern: **read** = `has_firm_access(auth.uid(), firm_id) OR platform_staff_can_access_firm(auth.uid(), firm_id)`; **write** = `has_firm_access` only, because support access is read-only. Tenant-keyed tables use `user_can_access_tenant`; client-keyed use `user_can_manage_client`. New policies target `to authenticated`, never `public`.

## 7. Support access (`firm_support_access`)

PK is `id`. `grantee_user_id` and `expires_at` are NOT NULL, with a CHECK capping expiry at 72h. Partial unique index on `(firm_id, grantee_user_id) WHERE granted AND revoked_at IS NULL`. **No unique constraint on `firm_id` alone** — never upsert on `firm_id`, never `.maybeSingle()` filtered only by it.

Staff insert a pending request for themselves only. Only `is_org_owner` may approve. **A super admin can never approve their own access.** Writes go through `context.supabase`, never `supabaseAdmin`.

## 8. Entitlement (separate from access control)

`client_entitlement` returns `(tier, source, expires_at, in_grace)` evaluated at READ TIME — expired trials fall back to `basic` on the next request, no scheduled job. `subscription_type` is `paid | free_forever | trial`; the 3-month offer is a Stripe coupon (`duration=repeating, duration_in_months=3`), NOT a subscription type. Comps are super-admin only, require a reason, and write an audit row.

**Entitlement must never widen who can SEE a client's data.**

Stripe: the practice's OWN account — `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (server only), `VITE_STRIPE_PUBLISHABLE_KEY`. `STRIPE_SANDBOX_API_KEY` is a different account, never a fallback.

## 9. Logging — telemetry vs audit

**`audit_log` is access and security events ONLY**, append-only: sign-ins, invites, membership and role changes, ownership transfers, support grants, comps, Xero connect/disconnect/token refresh, `xero_data_read`.

**`xero_api_errors` is disposable telemetry**: one row per `(day, path, http_status, tenant_id, firm_id)` with an `occurrences` counter, 30-day retention pruned on write. Write ONLY via `public.log_xero_api_error(...)` (service_role). No in-code deduplication. Never pass tokens, headers or payloads. Telemetry failures are swallowed.

## 10. Xero rules

- Resolve `tenant_id` SERVER-SIDE from the organisation/client the user is authorised for. **Never read tenantId from a request body, query string or header.**
- Tokens live in `xero_connections.access_token_enc` / `refresh_token_enc`. Never `select *` from `xero_connections` in client-reachable code.
- Refresh tokens rotate; store atomically, row-lock against concurrent refresh.
- On 401/403: `status='disconnected'`, stop syncing, prompt reconnect. No retry loops.
- **`Reports/ActivityStatement` DOES NOT EXIST** — never call it. Current BAS figures are not available from the Xero API at all.
- `Reports/BankSummary` requires `toDate - fromDate <= 365 days`.

## 11. Membership & invites

`firm_members.status` is `active | suspended | removed`; role is `owner | staff`. Removal sets status, never hard-deletes; only `active` counts. Invites are email-bound, single-use, expiring, storing a token HASH.

## 12. Outstanding work

The verified security backlog lives in `docs/security-backlog.md`. Read it before planning any access-control work, and update it in the same change that closes an item. Do not track outstanding work in this document — this section only points at it.

Two entries there are settled decisions, not tasks: **`FORCE ROW LEVEL SECURITY` is WON'T DO** (all `public` tables are owned by `postgres`, which has `rolbypassrls`, so FORCE changes nothing for any role the app connects as), and **token column exposure is CLOSED** (`authenticated` has SELECT on 13 non-token columns of `xero_connections`; `access_token_enc` and `refresh_token_enc` have no grant, and the privilege check precedes RLS).

## 13. Working agreement

One change at a time. After anything touching auth, RLS, membership, grants, entitlement, ownership or Xero tokens, restate which invariants in section 0 it touches and why they still hold. Never change an RLS policy as a side effect of a feature task.

**Report only what you verified in this turn.** Never describe the prior state of code or database from memory or from earlier in the conversation — re-read it. Say exactly what you changed, even when it differs from what was asked.
