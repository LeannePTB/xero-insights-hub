# Phase 2 part 2 — review corrections, plus the urgent ownership fix

Classification: SECURITY-RELEVANT (RLS policies, table grants, super-admin powers, ownership).

Part A is documentation and tests only. Part B is a real database change, planned here and applied as its own separate change.

## Re-verified live, 11 September 2026

All four points below were read from the live catalogue this turn, not from memory.

- `firms` policies: `super_admin updates firms` — `FOR UPDATE`, `USING` and `WITH CHECK` are `app_private.is_super_admin(auth.uid())` alone. Also `firm owners update own firm` (`is_firm_owner`), `super_admin reads firms`, `firm members read own firm`, and the restrictive `mfa_aal2_required`.
- `firms` grants: `authenticated` holds SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER at table level. There are **no column-level grants**, so the UPDATE covers every column, `owner_user_id` and `is_always_free` included.
- `firms` triggers: only `firms_set_updated_at`. No audit row is written by the database on any update.
- `client_subscriptions`: `super admins manage client subscriptions` is `FOR ALL`, `USING`/`WITH CHECK` = `app_private.is_super_admin(auth.uid())`; `staff manage client subscriptions` is `FOR ALL` on `platform_staff_can_access_firm` (so an active support grant is admitted). Only trigger is `client_subscriptions_set_updated_at`. No audit row from the database.

So both escalations described in the review are real and reachable by a direct REST call from an aal2 super-admin session with no membership.

Two further facts, recorded but not acted on: the four `firms` policies target role `public`, not `authenticated` (Spec §6 says `to authenticated`), and no `firms` update path writes an audit row from the database layer.

### Has it been used?

Read-only check of all four organisations: every one has `owner_user_id = 57d544ad…` (the same super admin), and `audit_log` holds **zero** rows for any owner/ownership action against any of them. `updated_at` values (8 Sep, 26 Aug, 26 Aug, 17 Aug) are all consistent with the rename, logo and subscription edits recorded in the audit log for those dates. There is no evidence of an ownership change through this path, but there is also no audit trail that could prove one either way — that absence is itself part of the finding.

## Part A — revert three matrix decisions (docs and tests only)

1. **`firms` UPDATE by a bare super admin → KNOWN FAILURE, new backlog item 27.** Every PLATFORM_ONLY update row on `firms` in `docs/security/access-matrix.ts` is marked `knownFailure: 27` and expected to *fail*, so `bun run security:check` prints it in the KNOWN FAILURES block instead of passing it. Breaks invariant 3 and Spec §4. Bare super-admin **read** of `firms` stays allowed (Path C organisation list).
2. **`client_subscriptions` INSERT/UPDATE/DELETE → KNOWN FAILURE, new backlog item 28**, covering both the `super_admin` rows and the `support_grant_active` rows admitted by the `staff manage client subscriptions` policy. The note "Every change writes an audit row" is deleted — it is false. Reads stay allowed as billing metadata. Fix scheduled for Phase 3.
3. **`firm_members` read by a bare super admin** stays allowed, and gains an explicit note: owner-approved Path C platform metadata, membership list only, no financial data.

Then regenerate `docs/security/access-matrix.md`, add items 27 and 28 to `docs/security-backlog.md`, and re-run `bun run security:check` — it must report these rows as known failures with their backlog numbers, and 0 unexpected failures.

## Part B — urgent fix for the ownership escalation (item 27)

### Who legitimately updates `firms` today

Every one of them runs server-side through `supabaseAdmin` (service_role), which is unaffected by grants to `authenticated`:

| Column | Path | Caller check | Audit |
|---|---|---|---|
| `name` | `adminRenameFirm` (`src/lib/admin.functions.ts:46`) | aal2 + `assertSuperAdmin` | yes |
| `name`, `owner_user_id` | `acceptInvite` (`src/lib/invites.functions.ts:456`) | invite token | yes |
| `owner_user_id` | organisation creation (`invites.functions.ts:136`, `:174`) | aal2 + super admin | yes |
| `logo_path` | `setOrganisationLogo` / `clearOrganisationLogo` (`src/lib/branding.server.ts:63`, `:158`) | `assertOrganisationStaff` | set: yes; clear: **no** |
| `is_always_free` | `admin.functions.ts:270` | aal2 + `assertSuperAdmin` | yes (inside the subscription audit row) |
| `default_widgets` | `public.set_firm_default_widgets` (definer) | active member, in-database | in-function |
| `owner_user_id` | `public.transfer_organisation_ownership` (definer) | current owner, in-database | in-function |

**No browser code updates `firms` at all** — `rg 'from("firms")'` across `src/components`, `src/routes` and `src/hooks` returns nothing. So the table-level UPDATE grant to `authenticated` serves no legitimate purpose.

### Direction (recommended, simpler than the proposal)

- Revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on `public.firms` from `anon` and `authenticated`. Grant SELECT only. **No column grants are needed**, because no legitimate browser path writes this table.
- Drop the `super_admin updates firms` policy, and re-target the remaining `firms` policies to `authenticated` (they are on `public` today). Keep `firm owners update own firm` for now as defence in depth — with no UPDATE grant it cannot be reached; drop it in Phase 7 if the owner prefers.
- `owner_user_id` changes: only `transfer_organisation_ownership` and the two organisation-creation/invite-acceptance paths, which run as service_role.
- `is_always_free`: move `admin.functions.ts:270` behind a new definer function `public.set_firm_always_free(_firm_id, _value, _reason)` that asserts aal2 + `me_is_super_admin()`, **refuses any organisation that has clients or is not the practice's own**, and writes its own `audit_log` row. This is the only new function needed.
- Add the missing audit row to `clearOrganisationLogo`.

Nothing in the browser breaks: the only screens that edit an organisation (rename, logo, default cards, ownership transfer, plan/comp) already call server functions or definer RPCs.

### Matrix rows added by Part B

- bare super admin UPDATE `owner_user_id` on `firms` → denied (retires known failure 27)
- bare super admin UPDATE `is_always_free` → denied
- organisation owner UPDATE `name` / `logo_path` via the server function → allowed
- `transfer_organisation_ownership` by the current owner → allowed; by a bare super admin → denied
- `set_firm_always_free` on an organisation with clients → refused

## Part C — recorded for part 3, not built now

The sandbox database role cannot execute `public.security_posture()` (`permission denied for function`), so gate step 2 cannot be run by the agent today. In part 3, `bun run security:check` gains a step that calls `security_posture()` through the security-runner aal2 session and fails the run on any unexpected Action. Recorded in `roadmap.md` under part 3.

## Files and migrations

**Part A (no migration):** `docs/security/access-matrix.ts`, regenerated `docs/security/access-matrix.md`, `docs/security-backlog.md` (items 27, 28), `roadmap.md` (part 3 note).

**Part B (one migration, applied as a separate change):** revoke/grant on `public.firms`; drop `super_admin updates firms`; re-target `firms` policies to `authenticated`; create `public.set_firm_always_free(...)` with `assert_aal2` + super-admin guard, `SET search_path`, `REVOKE EXECUTE FROM PUBLIC, anon`. Code: `src/lib/admin.functions.ts` (call the new function), `src/lib/branding.server.ts` (audit row on logo clear), plus matrix and backlog updates.

## Owner decisions needed

1. **`is_always_free` rule.** Recommend: refuse it on any organisation that has clients, so it can only ever apply to the practice's own organisation. Confirm that matches intent.
2. **Keep or drop `firm owners update own firm`.** Recommend keeping it, unreachable, until Phase 7 — dropping it is a behaviour change we cannot fully test until the live suite exists.
3. **Part B timing.** Recommend applying it immediately after Part A, before part 3, since it is a live privilege escalation.
4. **Item 28 (`client_subscriptions`) in Phase 3** as you directed — recorded, not fixed now.

## Verification

Part A: `bun run security:check` — fingerprint matches, 0 unexpected failures, items 27 and 28 printed as known failures with the matrix row counts.
Part B: re-read `firms` grants with `has_table_privilege` and `aclexplode` (expect SELECT only for `authenticated`); re-read the policy list; prove in the regenerated PGlite fixture that a bare super admin's `owner_user_id` update is denied and an owner's rename through the server path still succeeds; confirm each of the seven paths in the table above still works; Supabase linter shows no new finding class. Security report at the end of each part.
