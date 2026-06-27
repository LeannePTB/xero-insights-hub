## Goal

Fix Security Posture MFA counts so they reflect reality. The current `getSecurityPosture` uses `supabaseAdmin.auth.admin.listUsers()` and reads `u.factors`, but the Auth Admin list endpoint does not return `factors` — so enrolment always reads 0 even when users have verified TOTP factors.

Replace that path with a `SECURITY DEFINER` SQL function that aggregates directly from `auth.mfa_factors`, and add a second posture row for "Super admin MFA enforced".

## Role mapping note

The user's snippet uses `role = 'admin'`. This project has no `admin` enum value — staff roles are `super_admin` and `advisor` (see `handle_new_user`, `me_is_super_admin`, and existing posture code that scopes MFA to `advisor + super_admin`). I'll keep that scoping:

- **Staff** = users with role `advisor` or `super_admin` (matches today's "total" denominator)
- **Admin** in the new "Admin MFA enforced" row = `super_admin`

If you'd rather count *all* `auth.users` for the team row, say so and I'll widen the CTE.

## 1. Migration

New SECURITY DEFINER function `public.get_mfa_posture_counts()` returning a single row:

- `total_staff` — distinct users with `advisor` or `super_admin`
- `enrolled_staff` — of those, how many have a verified TOTP factor in `auth.mfa_factors`
- `total_admins` — distinct `super_admin` users
- `enrolled_admins` — of those, how many have a verified TOTP factor

Reads `auth.mfa_factors` and `public.user_roles` directly. `EXECUTE` revoked from `PUBLIC`, `anon`, `authenticated`; granted to `service_role` only (the posture function calls it via `supabaseAdmin`).

## 2. Update `src/lib/security.functions.ts`

In `getSecurityPosture`:

- Remove the `auth.admin.listUsers()` block and the `staffIds` / `u.factors` derivation.
- Call `supabaseAdmin.rpc("get_mfa_posture_counts")`, take `rows?.[0]`, default to zeros on error.
- Return `mfa: { enrolled: enrolled_staff, total: total_staff }` (preserves the existing card field shape) and add `adminMfa: { enrolled: enrolled_admins, total: total_admins }` to the payload.

## 3. Update `src/components/admin/SecurityPostureCard.tsx`

- Keep the existing "TOTP MFA enrolment" row; it now shows real numbers.
- Add a new row "Super admin MFA enforced" driven by `data.adminMfa`, status `ok` when `total>0 && enrolled===total`, else `action`. Detail: `"{enrolled}/{total} super admins have a verified authenticator app factor."` or `"No super admin users found."` when `total===0`.

## 4. Verify

After the migration is approved and the deploy lands, open `/admin/security`. Both rows should now show real ratios (e.g. `1/1` for super-admin MFA, and the staff total matching the count of `advisor + super_admin` users with verified TOTP).

## Technical notes

- The Postgres function is SECURITY DEFINER and owned by the migration role, so it can read `auth.mfa_factors` even though that schema isn't exposed via PostgREST.
- `EXECUTE` is restricted to `service_role`; the function is never reachable from the browser, only from `supabaseAdmin.rpc(...)` inside `getSecurityPosture` (which already gates on `me_is_super_admin`).
- No change to the Auth Admin API usage elsewhere; only the MFA counting path is replaced.
