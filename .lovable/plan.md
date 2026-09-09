# Make the app ask the database, not re-decide (invariant 7)

Plan only. Nothing below is implemented yet. Verified this turn by reading the helper
source and dumping the live function definitions and EXECUTE grants.

## 1. Inventory — helper vs its database equivalent

| # | Helper (file) | What it decides | Database equivalent |
|---|---|---|---|
| 1 | `userCanManageClient` (`src/lib/xero/client-orgs.server.ts:59`) | Client owner OR active member of the client's organisation | `app_private.user_can_manage_client` |
| 2 | `canManageClient` (`src/lib/loan-consolidation.functions.ts:154`) | Plan gate + active member, else super_admin **with** live support grant | `app_private.user_can_manage_client` (plan gate has no equivalent) |
| 3 | `canReadClient` (`loan-consolidation.functions.ts:167`) | manage OR a `client_access` row | `app_private.user_can_read_client` |
| 4 | `firmMemberRole` (`loan-consolidation.functions.ts:103`) | Active membership role string | `app_private.has_firm_access` + `app_private.is_firm_owner` (no role-returning equivalent) |
| 5 | `isSuperAdminUser` (`loan-consolidation.functions.ts:120`) | Holds `super_admin` | `app_private.is_super_admin` |
| 6 | `hasClientAccess` (`loan-consolidation.functions.ts:130`) | A `client_access` row | `app_private.has_client_access` |
| 7 | `assertFirmAccess` (`src/lib/consolidation-groups.functions.ts:30`) | Active member, or support grant on read; then plan gate | `public.firm_access_path` (returns `member` / `support_grant` / `none`) |
| 8 | `resolveAccess` + `assertAccess` (`src/lib/firm-subscription.functions.ts:44`) | Owner / member / super_admin, and **super_admin alone passes** | `public.firm_access_path` + `app_private.is_firm_owner` |
| 9 | `getEffectiveTier` / `assertWidgetAccess` (`src/lib/xero/access.server.ts`) | Tenant → client → membership → tier ranking → widget list | `app_private.user_can_access_tenant`, `public.client_allowed_widgets`, `public.client_can_use_widget` |
| 10 | `platformStaffCanAccessFirm`, `canAccessClient` (`src/lib/support-access.server.ts`) | Firm / client access | Already thin wrappers over `public.user_can_access_firm` / `user_can_access_client` — the reference shape |
| 11 | `canManageClientNotes` (`src/lib/notes-access.server.ts`) | Who may flag a note for the report | Calls `user_can_access_firm` already |
| 12 | `assertTenantBelongsToClient` (`src/lib/tenant-ownership.server.ts`) | Tenant belongs to this client | No equivalent — ownership proof, not access. Leave. |

## 2. Where they differ — the part that matters

**A. `userCanManageClient` is stricter than `user_can_manage_client`, deliberately.**
The database function also grants when the caller is `super_admin` **and** holds a live
support grant. That is a *read-only* Path B grant appearing inside a function named
"manage", used by `disconnectXero`, file moves and allowance writes. The TypeScript is
the correct behaviour for writes; the database function is the wider one. **Do not
swap this helper for that function.** Write paths should move to
`public.assert_client_write_access` (owner OR active member, no super_admin, no support
grant) — which matches today's TypeScript exactly.

**B. `resolveAccess` (firm subscription) is a live cross-organisation bypass — new.**
`assertAccess` passes on bare `super_admin`, and the handler then switches to
`supabaseAdmin` for non-members (`firm-subscription.functions.ts:80-82`), reading a
firm's name, plan, status and client count without membership or a support grant.
This is invariant 3, organisation data, not Path C metadata. It is a fourteenth
instance of the same fault, found while writing this plan. It needs its own change.

**C. `canManageClient` (loan) already matches the database limb-for-limb**, including
the support-grant limb — it is the closest to correct in the codebase. It adds a plan
gate the database access rule does not have; that stays.

**D. `canReadClient` omits one limb the database has.** `user_can_read_client` also
accepts active membership of the client's organisation directly; the TypeScript reaches
that only via `canManageClient`, which is gated on the plan first. Net effect: a member
of an organisation whose plan lacks loan consolidation is refused. That is intended
(plan gate), so the difference is safe but must be preserved when swapping.

**E. `canManageClientNotes` is wider than its comment claims.** It calls
`user_can_access_firm`, which includes live support grants — so a read-only Path B
grantee could flag a note into the management report. A write reachable through a
read-only grant. Flagged; not part of this work.

**F. `getEffectiveTier` reimplements the most.** Tenant→firm resolution, membership,
`client_access` tier ranking and the widget deny-list all live in TypeScript while the
database has `user_can_access_tenant` and `client_allowed_widgets`. It also grants
`investigate` to any member, which no database function says. Highest-value target,
highest risk to cards — last.

**G. `firmMemberRole` and `isSuperAdminUser` agree with the database** (both filter
`status = 'active'`; `is_super_admin` is the same query). No behavioural gap.

## 3. What the application can actually call today

Everything in `app_private` is unreachable over the API — PostgREST exposes `public`
only, for `authenticated` and `service_role` alike, whatever the EXECUTE grant says.

Reachable now:
- `public.user_can_access_firm`, `public.user_can_access_client` — `authenticated` + `service_role`
- `public.assert_client_write_access(_client_id)` — `authenticated`; uses `auth.uid()`, so it must be called on `context.supabase`, never `supabaseAdmin`
- `public.client_allowed_widgets`, `client_can_use_widget`, `firm_allowed_widgets`, `firm_can_use_widget` — `authenticated`
- `public.firm_access_path(_user_id, _firm_id)` — **`service_role` only**; call it through `supabaseAdmin`. This is the one that distinguishes `member` from `support_grant`, which is exactly what the read/write split needs.

The `_user_id` parameter is honoured only when `auth.uid()` is null (service_role);
under a user session the functions ignore a foreign `_user_id` and return false. So
`supabaseAdmin` + explicit `_user_id`, or `context.supabase` + own id — never mixed.

**No new `public` wrappers are proposed.** `firm_access_path` and
`assert_client_write_access` already cover every case in the sequence below. If step 5
later needs a tenant-level check, `app_private.user_can_access_tenant` would need a
wrapper — that decision is deferred, not assumed.

## 4. Cost

Each swap replaces one or two PostgREST round trips with one RPC, so most steps are
neutral or slightly cheaper. Two places are not:

- `canReadClient` / `canManageClient` run once per loan-consolidation server function,
  and the loan pages call several in sequence — the plan gate already costs two RPCs
  there.
- `assertWidgetAccess` runs per widget on a dashboard render.

Mitigation: a request-scoped memo (a `Map` keyed `userId:firmId` / `userId:clientId`,
created per server-function invocation, never module-level and never persisted) around
the access RPCs only. Nothing cached across requests, nothing in the JWT or
localStorage — invariant 6. If the memo adds complexity where the call happens once,
skip it.

## 5. Sequence — reversible, testable, riskiest last

Each step is one commit, one file or one helper, with a typecheck and a manual pass over
the affected screen.

1. **`assertFirmAccess` → `firm_access_path`.** Smallest, self-contained, four callers.
   Breakage would show as "You don't have access to this organisation" on the
   consolidation groups screen.
2. **`hasClientAccess`, `firmMemberRole`, `isSuperAdminUser`** — leave the first two,
   remove `isSuperAdminUser` if it ends up unused after step 3. No behaviour change.
3. **`canReadClient` / `canManageClient` → `user_can_read_client` (via a `public`-reachable
   path) + `firm_access_path`, keeping the plan gate in front.** Breakage shows as loan
   consolidation cards refusing to load for members, or DRTABT's cross-client pairings
   failing.
4. **Write paths off `userCanManageClient` → `assert_client_write_access`.** Affects
   `disconnectXero`, file linking and moving, allowance writes. Breakage is loud and
   immediate: "NO_ACCESS" on disconnect or link. Behaviour is identical to today's
   TypeScript by inspection, but this is the destructive one, so it goes after 1-3.
5. **`getEffectiveTier` / `assertWidgetAccess`.** Last. Touches which cards render.
   Not started until 1-4 are live and quiet; would need a per-client before/after
   comparison of visible widgets for all twelve clients before it lands.

`resolveAccess` (finding B) is a separate security fix, not part of this refactor, and
should be decided before or alongside step 1 — it is a live hole, not drift.

## 6. What not to do

- **Do not replace `userCanManageClient` with `user_can_manage_client`.** The database
  function admits support grants into a write path; that would widen access.
- **Do not remove the plan gates** in loan consolidation and consolidation groups. The
  database access functions decide access, not entitlement; those are separate rules
  (§8) and the plan gate has no access equivalent.
- **Do not touch `assertTenantBelongsToClient`.** It proves ownership of a tenant by a
  client, which no database function does.
- **Do not change `notes-access.server.ts`** in this work — finding E is a separate
  decision about whether report flagging is a write.
- **Do not change `setClientXeroAllowance`** — its escalation is a recorded decision.
- **Do not rewrite any database function.** They are the reference.

## Constraints check

No RLS policy, trigger, grant, table or column change is proposed. `firm_access_path`
is already granted to `service_role`; nothing needs a new grant. No step changes what
any current account can do: all three staff are active members of all four
organisations, and the only helper whose swap could widen access (A) is explicitly
excluded.
