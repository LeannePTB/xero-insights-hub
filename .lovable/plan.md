## Problem

On `/dashboard`, super-admins see no "Admin" link in the header button row. The `/admin` route exists, but the dashboard never renders an entry point to it, and `getMyContext` doesn't tell the client whether the user is a super-admin.

## Changes

### 1. `src/lib/roles.functions.ts` — expose `isSuperAdmin`

Extend `getMyContext` to also check the super-admin role and return it:

- After loading `user_roles`, set `isSuperAdmin = roles.some(r => r.role === 'super_admin')`.
- Return `{ isAdvisor, isSuperAdmin, viewerClients }`.
- No new RPC call needed — `user_roles` is already queried, so this is a single derived boolean from existing data. Safe under RLS (a user can only read their own role rows).

### 2. `src/routes/_authenticated/dashboard.tsx` — render Admin link

- Read `isSuperAdmin` from `ctxQ.data`.
- When `isSuperAdmin` is true, render an "Admin" button (outline variant, Shield icon from lucide-react) in the advisor action row, placed first so it reads left-to-right as: **Admin · Advisors · Tier widgets · Activity · My account · New client**.
- Link target: `to="/admin"`.
- Show it independently of `isAdvisor` — a super-admin who isn't also an advisor should still see it. (Practically all super-admins are advisors, but don't couple the two.)

### 3. `src/routes/_authenticated/admin.index.tsx` — drop stale comment

The file has a comment saying "if getMyContext doesn't expose isSuperAdmin yet, the server fn will throw and we show Forbidden." After change #1 that's no longer true — remove the comment so future readers aren't confused.

## Out of scope

- No DB migration. `me_is_super_admin()` RPC stays as-is for `admin.functions.ts` and `invites.functions.ts` callers.
- No change to who counts as super-admin or how the role is assigned.
- No styling/layout redesign of the dashboard header beyond inserting one button.

## Verification

1. Sign in as your super-admin account → `/dashboard` should now show an "Admin" button at the start of the action row.
2. Click it → lands on `/admin` and the firms list renders (not "Forbidden").
3. Sign in as a non-super-admin advisor → no Admin button, everything else unchanged.
4. Sign in as a pure viewer → no Admin button, only "My account" visible (unchanged).
