## Why it shows 5

`getSecurityPosture` (in `src/lib/security.functions.ts`) calls `auth.admin.listUsers()` and counts every account in Supabase Auth — that includes the 3 advisors plus any client-viewer / invited / test accounts, so the total comes out as 5.

## Fix

Scope the MFA enrolment metric to **staff users only** (advisors + super admins), since they're the ones the Xero security standard requires to be MFA-enrolled. Client viewers shouldn't count toward the denominator.

### Change

In `src/lib/security.functions.ts` `getSecurityPosture`:

1. Pull the staff user id set from `user_roles` where `role in ('advisor','super_admin')` (deduped).
2. Fetch users from `auth.admin.listUsers` as today, then filter to that id set before counting.
3. `totalUsers` = staff count; `mfaEnrolled` = staff users with a verified TOTP factor.

### UI copy

Update the detail string in `src/routes/_authenticated/admin.security.tsx` from "users enrolled" to "staff users enrolled" so it's clear client viewers aren't in scope.

No schema changes, no migration.