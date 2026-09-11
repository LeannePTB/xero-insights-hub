# Phase 4 — One rulebook

**Security classification: SECURITY-RELEVANT.** Touches authorisation on every user-initiated
server function, `supabaseAdmin` use, SECURITY DEFINER functions and grants.

Goal (rules 6 and 7): every user-initiated server function either reads/writes through
`context.supabase` so RLS decides, or — only where service role is genuinely required — calls one
named aal2-guarded database authorisation function first and then uses `supabaseAdmin` for that
narrow step. No TypeScript lookup of `user_roles`, `firm_members`, `client_access` or
`firm_support_access` decides access.

## What was verified for this plan (11 Sep 2026, read-only)

- 56 files in `src/` reference `supabaseAdmin`; 115 raw reads of the four access tables remain,
  concentrated in `clients.functions.ts` (22), `advisors.functions.ts` (16),
  `xero/client-orgs.server.ts` (6), `invites.functions.ts` (6), `xero/access.server.ts` (5),
  `support-access.functions.ts` (5), `firms.functions.ts` (5).
- Database helpers that already exist and must be reused, not duplicated:
  `public.user_can_access_firm`, `public.user_can_access_client`, `public.user_can_write_firm`,
  `public.user_can_write_client`, `public.assert_client_write_access`, `public.client_entitlement`,
  `public.client_can_use_widget`, `public.firm_can_use_widget`, `public.firm_plan_limits`,
  `public.xero_tenant_already_linked`; and in `app_private`: `is_super_admin`, `me_is_super_admin`,
  `user_can_read_client`, `user_can_write_client`, `user_can_manage_client`, `has_tenant_access`,
  `user_can_access_tenant`, `platform_staff_can_access_firm`, `firm_ids_for_tenant`.
- There is **no `public` wrapper** for super-admin status or for tenant access — that is why six
  local `assertSuperAdmin` copies and the TypeScript tenant gate exist.
- The four "unverified" files sampled all confirm the same pattern (local `assertSuperAdmin` +
  `supabaseAdmin` in `plan-levels`, `tier-config`, `firm-subscription`, `support-access`,
  `ownership`, `subscription-state`); `xero/scope-status.functions.ts` in fact uses
  `context.supabase` only.

## 1. New database authorisation functions (minimal set)

All aal2-guarded (`app_private.assert_aal2()` first), `SET search_path`, `REVOKE EXECUTE FROM
PUBLIC, anon`, `GRANT EXECUTE TO authenticated`.

| Function | Purpose | Replaces |
| --- | --- | --- |
| `public.me_is_super_admin()` | Caller-scoped super-admin test | six `assertSuperAdmin` copies |
| `public.assert_super_admin()` | Same, raises `42501` | the throw half of those copies |
| `public.user_can_access_tenant(_user_id, _tenant_id)` | Wrapper over the existing `app_private` helper | tenant gates in `access.server.ts`, `search.functions.ts`, `audit.functions.ts` |
| `public.client_for_tenant(_tenant_id)` | **Deterministic** client for a Xero tenant (ordered by `client_xero_orgs.created_at, id`; raises if ambiguous rather than picking) | the nondeterministic `.limit(1)` in `getEffectiveTier` |
| `public.effective_tier_for_tenant(_user_id, _tenant_id)` | Returns `(is_staff, tier, client_id)` using the read helper | the body of `getEffectiveTier` |
| `public.assert_widget_access(_tenant_id, _widget)` | Caller-scoped: access + entitlement in one call, reusing `client_entitlement` / `client_can_use_widget` | `assertWidgetAccess`, `widget-access.server.ts` |
| `public.assert_tenant_belongs_to_client(_client_id, _tenant_id)` | Consistency check moved into the database | `tenant-ownership.server.ts` |

No other new functions. Everything else calls the existing helpers.

## 2. Inventory and target pattern

Pattern **(a)** = drop `supabaseAdmin`, use `context.supabase` (RLS decides).
Pattern **(b)** = call the named DB function first, then `supabaseAdmin` for the narrow privileged
step only (`auth.admin`, token decryption, storage, cross-tenant system reads).
Pattern **(s)** = system context, unchanged.

| File | Current authorisation | Target | DB function |
| --- | --- | --- | --- |
| `xero/access.server.ts` | TypeScript over 4 tables, `.limit(1)` | b | `effective_tier_for_tenant`, `assert_widget_access` |
| `widget-access.server.ts` | raw entitlement reads | a | `client_can_use_widget` / `firm_can_use_widget` |
| `tenant-ownership.server.ts` | consistency check | b | `assert_tenant_belongs_to_client` |
| `xero/snapshot-read.server.ts`, `snapshot-refresh.server.ts` (manual), `recon-snapshot.server.ts`, `scenario.functions.ts`, `search.functions.ts`, `consolidated.functions.ts`, `audit.functions.ts` | inherit the gate above / raw `firm_members` | a where the read is RLS-visible, else b | `assert_widget_access`, `user_can_access_tenant` |
| `clients.functions.ts` (22 raw reads) | raw membership/role | a for reads and writes; b only for `auth.admin` viewer creation | `user_can_read_client`, `user_can_write_client`, `user_can_write_firm` |
| `loan-consolidation.functions.ts`, `loan-autosetup/recon/mismatch.server.ts` | `canManageClient`/`canReadClient` | b | `user_can_read_client` / `user_can_write_client` |
| `consolidation-groups.functions.ts`, `xero/onboard.server.ts`, `xero/client-orgs.server.ts`, `xero/connections.functions.ts`, `unreconciled.functions.ts` | mixed | a/b | firm + client helpers, `firm_plan_limits` |
| `admin`, `advisors`, `firms`, `invites`, `security`, `plan-levels`, `tier-config`, `ownership`, `xero/orphan-connections` | six local `assertSuperAdmin` copies | b (a where the table is readable under RLS) | `assert_super_admin` |
| `firm-subscription.functions.ts`, `subscription-state.server.ts`, `support-access.functions.ts`, `health.functions.ts`, `access.functions.ts`, `login-log.functions.ts`, `audit.functions.ts` (reads) | raw reads | a | `user_can_access_firm`, `assert_super_admin` |
| `reports/*.server.ts`, `email/send.server.ts`, `branding.server.ts`, `report-pdf.server.ts` | pipeline / RPC-backed | s / b unchanged | — |
| `xero/api.server.ts`, `first-link-refresh`, `scopes`, `authorised-tenants`, `authorisation-freshness`, `rate-limit`, `audit.server.ts`, `invites` pre-session, `api/public/xero/callback.ts` | system | s | — |

**Resolution of the 16 "unverified" files:** `plan-levels`, `tier-config`, `ownership`,
`firm-subscription`, `subscription-state`, `support-access`, `health`, `xero/audit` are confirmed
rule 7 violations of the same local-check pattern and move to batch 3/4;
`xero/authorised-tenants`, `xero/authorisation-freshness`, `xero/scopes` are confirmed **system
context** (background refresh, fixed configuration); `xero/scope-status` uses `context.supabase`
only and its register row is stale; the remainder are covered in their batch.

## 3. Batches

Each batch ends with `bun run security:check`, `bunx tsgo --noEmit`, the linter, matrix rows and a
Security report. Batches ship independently.

**Batch 1 — Xero read gate (highest risk).** `xero/access.server.ts`, `widget-access.server.ts`,
`tenant-ownership.server.ts`, `snapshot-read`, `snapshot-refresh`, `recon-snapshot`, `scenario`,
`search`, `consolidated`, `xero/audit.functions.ts`, `unreconciled`. DB: the five tenant/widget
functions above. Matrix rows: member/viewer/support/bare-super-admin × read tenant, widget allowed
and denied, ambiguous tenant. Owner tests: each dashboard card for a member and a client viewer.
~medium-large.

**Batch 2 — client data reads and writes.** `clients.functions.ts`, `loan-*`,
`consolidation-groups`, `xero/client-orgs.server.ts`, `xero/onboard.server.ts`,
`xero/connections.functions.ts`. DB: reuse only. Owner tests: add/delete client, invite viewer,
link/move a Xero file, loan consolidation. ~large.

**Batch 3 — super admin / Path C.** `admin`, `advisors`, `firms`, `invites`, `security`,
`plan-levels`, `tier-config`, `ownership`, `xero/orphan-connections`. DB: `assert_super_admin`.
Owner tests: admin console, plans, tier config, invites, ownership transfer. ~medium.

**Batch 4 — subscriptions, health, support, reports/email/branding review.**
`firm-subscription`, `subscription-state`, `support-access.functions`, `health`, `access.functions`,
`login-log`, `audit.functions`, plus confirming the report/email/branding rows stay system context.
~medium.

**Batch 5 — leftovers and closure.** Backlog 22 (six `profiles.email` fallbacks → verified
`auth.users` email via a system-context helper) and backlog 23 (delete
`src/lib/api/example.functions.ts`), guard tightening, register rewrite, backlog 21/22/23 closed
with evidence. ~small-medium.

## 4. Behaviour must not change

Per batch the plan records `bun run security:check` totals before and after (rows, proved, known
failures, live-only) and the fixture fingerprint, plus a list of every user-visible behaviour that
could change. Known candidates, each an **owner decision** before it ships:

1. **A tenant linked to more than one client** currently resolves arbitrarily; deterministic
   resolution will raise instead. Recommendation: raise, and show "This Xero file is linked to more
   than one client" — there are no such rows today.
2. **Bare super admin loses Xero/client reads** that today come from `supabaseAdmin` bypassing RLS
   (invariant 3 says this is correct). Recommendation: apply; super admins join or request support
   access as Phase 3b already provides.
3. **Support grant on widget reads** — moving entitlement into the database may change what a
   grant holder sees on cards not covered by backlog 25. Recommendation: keep read parity, list any
   card that changes.
4. **Client viewer tier resolution** moves to the database `max()` rule; identical for current data.

Nothing that a member, client viewer or super admin (Path C) can legitimately do today is removed
without being flagged here first.

## 5. Guard tightening (end of batch 5)

- `tests/static-guards.test.ts` fails when a `supabaseAdmin` reference appears in a user-initiated
  server function without a preceding call to a **registered** database authorisation function
  (the allowed names live in one exported list next to the register).
- `docs/security/admin-client-register.md` keeps only two verdicts: `system context` and
  `exception — DB authorisation first`. No `KNOWN FAILURE` or `unverified` rows remain.
- Backlog 21, 22 and 23 closed with evidence (counts, matrix rows, guard output).

## 6. Owner decisions needed

| # | Decision | Recommendation |
| --- | --- | --- |
| 1 | Ambiguous tenant → error rather than arbitrary client | Yes |
| 2 | Bare super admin loses client/Xero data reads everywhere | Yes — invariant 3 |
| 3 | Batch order and shipping one batch per turn | Yes, as listed |
| 4 | `xero/authorised-tenants`, `authorisation-freshness`, `scopes` recorded as system context | Yes |
| 5 | Backlog 22 email source: a single system-context `auth.users` lookup helper | Yes |

## Out of scope
Xero disconnect/reconnect (Phase 5), stored-data read audit (Phase 6), excess grants (Phase 7),
live smoke suite (parked).
