# Member removal — implementation record (12 Sep 2026)

Classification: SECURITY-RELEVANT — membership, a new write path, audit.

## Verified live before building

- `firm_members.status` is `text` with `firm_members_status_chk CHECK (status IN ('active','suspended','removed'))`. Removal sets the status; no hard delete. `transfer_organisation_ownership` already uses `status='removed'` for the outgoing owner, so this reuses an existing shape.
- Every membership test is already active-only: `app_private.has_firm_access`, `app_private.is_practice_member_of`, `public.organisation_members`, `public.my_firm_ids`, `public.my_firm_memberships`, `public.firm_access_path` (via `has_firm_access`). `public.plan_level_usage_count` counts subscriptions and `client_access` rows, never members. No defect found.
- No removal function or screen exists anywhere. `admin_firm_members` (super admin) lists all statuses; `organisation_members` returns active only.

## 1. One database function

`public.remove_firm_member(_firm_id uuid, _user_id uuid)` — `plpgsql`, `SECURITY DEFINER`, `SET search_path = public`, `app_private.assert_aal2()` first, caller is always `auth.uid()` (the parameter is the target, never a claimed identity), row locked with `for update`.

Checks, in order, all failing closed:
1. caller must hold an **active** membership of `_firm_id` → `NOT_A_MEMBER`.
2. target must hold an **active** membership of `_firm_id` → `NOT_A_MEMBER_TARGET`.
3. self-removal is allowed for any non-owner; an owner removing themselves → `OWNER_MUST_TRANSFER`.
4. removing someone else requires the caller to be `owner` **and** the target to be `staff` → `NOT_PERMITTED`. Staff, support-grant holders and non-member super admins never satisfy this (a support grant is not a membership).
5. never strand the organisation: refuse if the target is the only active member (`LAST_MEMBER`), and an owner can never be removed by anyone (rule 4 covers it).

Then `status='removed'`, `updated_at=now()`, and one `audit_log` row `firm_member_removed` recording actor, target, previous role, previous status and organisation. `EXECUTE` revoked from `PUBLIC`/`anon`, granted to `authenticated`.

Nothing else is written: no `client_access`, `firm_viewer_access`, `xero_connections`, snapshot or account row is touched.

## 2. Server function

`removeOrganisationMember` in `src/lib/ownership.functions.ts`: `requireAal2`, thin call through `context.supabase.rpc` (never `supabaseAdmin`), error codes mapped to plain sentences.

## 3. Screen

`PeopleSection` member rows gain a Remove control, shown only when the viewer is the owner and the row is staff, plus "Leave this organisation" on the viewer's own row when they are not the owner. The confirmation names the person, states they lose access to every client in this organisation and their Xero data, that only a fresh invitation restores it, and that client viewer access, standing grants, Xero connections, snapshots, history and their account are untouched.

## 4. Matrix

New bespoke rows: owner removes staff (allow); owner removes a Traction Advisory member (allow); owner removes themselves (deny); last remaining member removed (deny); staff / support grant / non-member super admin / viewers remove anyone (deny); a member leaves (allow); removal changes no viewer or standing grant (allow). Existing rows must not change.

## 5. Close out

`docs/design/people-and-access.md` decision 8, `roadmap.md`, fixture, definer register, generated matrix, `bun run security:check`, typecheck, linter.
