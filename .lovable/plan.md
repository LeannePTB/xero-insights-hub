# Step 4 — Overview and team for every organisation, role-flag clean-up, primary advisor rule

Classification: SECURITY-RELEVANT (touches definer functions, routing based on role signals, and super admin/advisor removal). Two database changes are listed separately for approval.

## What I found (checked this turn)

- `overview_clients()` only returns clients where `app_private.is_practice_member_of(...)` is true. That helper joins `firm_members` to the platform-wide `practice_team`. So today a customer practice's own team gets an **empty** Overview, not just a missing menu link. Fixing the link alone is not enough.
- The same function also requires `user_can_read_client(auth.uid(), client)`, so it never returns a client the caller can't already read.
- `getMyContext` sets `isAdvisor = advisor role OR any membership` and `hasAdminAreaAccess = super admin OR advisor OR firm_owner OR any membership`. `isAdvisor` is used in two different senses: "can manage this client" (client dashboard, reports, client settings, breakeven, efficiency cards) and "is staff" (system.staff, dashboard chooser). `hasAdminAreaAccess` is used by `system.index.tsx`, `system.security.tsx` and `dashboard.tsx`.
- Sign-in and MFA pages all land on `/dashboard`, which then redirects: practice_team → `/overview`, super admin → `/system`, members → `/firms/:id`, single viewer → their client.
- `PRIMARY_ADVISOR_USER_ID` is checked only in TypeScript (`revokeAdvisor`) and the Platform staff page.
- Existing database rules: `admin_set_super_admin` blocks self-removal and removing the last super admin. `admin_remove_advisor` only enforces "at least one advisor remains", and it deletes **all** roles of the target (including `super_admin`) without a self check or a last-super-admin check. So the constant is **not** redundant today: without it, an advisor could remove the only remaining super admin through `revokeAdvisor`.

## 1. Overview for every practice

- New route `/firms/:firmId/overview` — the organisation's Overview. Same page body as today's `/overview`, with `firmId` passed as a filter.
- Organisation menu gets "Overview" as the first entry for active owners/staff of that organisation (from `getMyContext` memberships), whether or not they are on practice_team.
- `/overview` stays as the cross-organisation view, shown in the switcher area only for people with memberships in 2+ organisations. Same function, no filter.
- The filter narrows only. The caller's access still comes from the database. Passing a `firmId` they don't belong to returns zero rows, not an error and never data.
- Hide-client / hide-organisation and alert actions on the page are unchanged (same server functions and guards).

## 2. Team for every practice

People & access → Team members (`firm_members` owner/staff) is enough for Overview, Clients, Xero files, Consolidations and Settings once DB change A is in. There's nothing else missing for day-to-day work. practice_team stays in System Admin → Platform staff, only for auto-adding our staff to new organisations, and stops being required for Overview.

## 3. getMyContext role flags

Replace with separate signals, all from existing caller-scoped functions:

- `isSuperAdmin` (unchanged)
- `isPlatformStaff` = `super_admin` or `advisor` role. Platform staff only. Organisation membership never sets it.
- `memberships: { firmId, role: 'owner' | 'staff' }[]` (from `my_firm_memberships`, which already returns role)
- `isOrganisationMember` = memberships.length > 0
- `isClientViewer` = no memberships, not platform staff, and has `my_client_access` rows
- `isPracticeMember` kept for the Positive Traction cross-org Overview link only
- `canViewAs` unchanged

Then remove `isAdvisor`, `hasAdminAreaAccess`, `isFirmOwner`, `firmId`.

How each consumer changes:
- `system.index.tsx`, `system.security.tsx`, `system.staff.tsx`: use `isPlatformStaff` / `isSuperAdmin`. Their server functions already enforce this, so only the screen changes. Organisation-only members stop seeing a broken System page.
- **Client pages** (index, reports, settings, BreakevenWidget, EfficiencyRecommendations, TrueBreakevenSection, `useIsAdvisor`): "is advisor" really means "can manage this client". I'll switch these to a per-client signal `canManageClient` from DB change C, and replace `useIsAdvisor` with `useCanManageClient(clientId)`. Server writes keep their own checks. This flag only controls which buttons show.
- `dashboard.tsx`: becomes the landing redirector only (section 5). Its organisation chooser is replaced by the workspace switcher. The client-viewer chooser (several clients) stays, as that's the only place viewers can pick a client. `/dashboard` keeps working as a URL so existing links and email links don't break.
- Sidebar menu (`sidebar-nav.ts`): use `memberships` / `isPlatformStaff` instead of the old flags.

## 4. Primary advisor rule

The constant is not redundant (see findings). Proposal is DB change B, which makes the database enforce the real rule, "you can't remove the last super admin or yourself". Then I remove `PRIMARY_ADVISOR_USER_ID` from `advisors.functions.ts` and `system.staff.tsx` (including the "Primary" pill), and show the database's error message instead. I'm not proposing a new "primary" flag column. A named person shouldn't be special. The last-super-admin rule protects the platform without that.

## 5. Landing after sign-in (from `/dashboard`)

```text
platform staff (super_admin/advisor)        -> /system
  (practice_team staff with 2+ orgs and no platform role -> /overview)
organisation member, 1 org                  -> /firms/:id/overview
  (if that overview returns no clients      -> /firms/:id)
organisation member, 2+ orgs                -> /overview
client viewer, 1 client                     -> /clients/:id
client viewer, several                      -> chooser on /dashboard
none of the above                           -> "No access yet" message (as today)
```

This only decides which page opens. Every destination keeps its own server check.

## Routes and redirects

- New: `src/routes/_authenticated/firms.$firmId.overview.tsx`
- Kept: `/overview` (cross-organisation), `/dashboard` (redirector + viewer chooser)
- No URLs removed, so no new redirects.

## Files

Create:
- `src/routes/_authenticated/firms.$firmId.overview.tsx`
- `src/components/overview/OverviewView.tsx` (page body moved out of `overview.tsx` so both routes share it)
- `src/hooks/useCanManageClient.ts`
- `src/lib/nav/landing.ts` (one pure function for the landing decision) and its tests
- DB migrations for A, B, C

Change:
- `src/lib/roles.functions.ts` (new signals, old ones removed)
- `src/lib/overview/overview.functions.ts` (optional `firmId` filter, Zod uuid)
- `src/routes/_authenticated/overview.tsx` (uses OverviewView)
- `src/lib/nav/sidebar-nav.ts` and its tests (Overview entry per organisation)
- `src/routes/_authenticated/dashboard.tsx` (uses `landing.ts`, organisation chooser removed)
- `system.index.tsx`, `system.security.tsx`, `system.staff.tsx`
- `clients.$clientId.index.tsx`, `.reports.tsx`, `.settings.tsx`, `BreakevenWidget.tsx`, `EfficiencyRecommendations.tsx`, `TrueBreakevenSection.tsx`
- `src/lib/advisors.functions.ts` (constant removed)
- `docs/security/access-matrix.ts`, definer register, `docs/security-backlog.md` (close the two flagged items, add matrix rows)

Delete: `src/hooks/useIsAdvisor.ts`

## Database changes — need your approval

**A. `overview_clients(_firm_id uuid default null)` — changes who sees rows in Overview**
- Replace the `is_practice_member_of` condition with "caller is an active `firm_members` row (owner or staff) of the client's organisation". Keep `user_can_read_client(auth.uid(), id)`, the AAL2 check, the hidden flags and the limit. Add `and (_firm_id is null or c.firm_id = _firm_id)`.
- Why: customer practices can't use Overview at all today.
- What it does and doesn't widen: it adds customer owners/staff as Overview users, but only for clients they can **already** read through membership (path A). It does not add support grants (B), external advisers (D) or business owners (E). Their access comes through other paths, and the active-membership condition excludes them. Super admins with no membership still get nothing (invariant 3).
- I'll also check the snapshot reads behind `getClientOverview` don't depend on practice_team anywhere else, and change them in the same migration if they do.
- Old no-argument signature dropped and recreated with the default. Execute stays revoked from `PUBLIC`/`anon`.

**B. `admin_remove_advisor(_user_id)` — closes a gap**
- Add: refuse when `_user_id = auth.uid()`, and refuse when the target holds `super_admin` and no other super admin would remain. The existing advisor-remains rule stays.
- Why: makes the constant redundant and closes the path to removing the last super admin. This only tightens the rule.
- Question: the Platform staff page currently allows "Remove your own advisor access (you'll be signed out)". Change B blocks that. Is that OK, or should self-removal stay allowed when another advisor and another super admin remain?

**C. `me_can_manage_client(_client_id uuid) returns boolean` — new, read-only**
- Caller-scoped (no user parameter), `SET search_path`, `assert_aal2()`, returns `app_private.user_can_write_client(auth.uid(), _client_id)`, which is the same predicate the client write paths already use. Execute revoked from `PUBLIC`/`anon`.
- Why: client pages currently show advisor buttons to any member of any organisation, based on the conflated flag. This gives the real per-client answer without TypeScript re-implementing access (invariant 6). It's only a screen signal and grants nothing.

## How guards are preserved

- No change to RLS policies, grants, `firm_members` / `client_access` / `firm_viewer_access` / `firm_support_access` rules, or any write predicate.
- Every route keeps its server function guards (`requireAal2` plus the database checks). Menus and landing decisions only change what's shown and which page opens.
- `firmId` in Overview is a filter (invariant 4). Support access stays read-only and isn't added to Overview. Client viewers never get the organisation menu.
- Checks after building: `bun run security:check`, `security_posture()`, linter, nav and landing tests, tsgo, build, and a security report.

## Conflicts with docs/security/*

- Change A changes who can see existing rows through Overview. Section 4 of the rules requires your sign-off, which is why it's listed here. Within path A, I don't see any conflict with the access paths.
- Change B is a definer change on role management. It only tightens, but it needs to be logged in the register and matrix.
- No new role, access path or exception.

## Not in this step

Favicon, PDF and email-sender branding wiring. Rent arrears on Overview.
