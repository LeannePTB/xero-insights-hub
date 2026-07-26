
## What's actually broken

Both problems have the same root cause. A hardening migration on 30 Jun revoked `EXECUTE` on `public.me_is_super_admin()` from the `authenticated` role:

```sql
-- 20260630020728_...sql
REVOKE EXECUTE ON FUNCTION public.me_is_super_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.me_is_super_admin() TO service_role;  -- only role left
```

That single change cascades into everything you're seeing:

1. **Security → Posture** — `permission denied for function me_is_super_admin`. The posture card calls the RPC directly and now 403s for every signed-in user, including you.
2. **Admin → Organisations shows only "Open clients"** — `admin.index.tsx` branches on `isSuper`. Because the RPC throws, `isSuper` resolves false, so you get the reduced advisor table (name + Open clients) instead of the super-admin table with the **Admin details** link. The Always-free toggle lives on `/admin/firms/{firmId}` behind that link, so from the current UI it's unreachable.
3. **Any other surface gated on super-admin** (audit-log actions, admin billing page, tier settings menus that hide their heavier controls) silently degrades the same way.

The revoke was overzealous. `me_is_super_admin()` is `SECURITY DEFINER`, takes no arguments, and only checks the caller's own `auth.uid()` against `user_roles` — letting `authenticated` execute it does not leak anything. The RLS policies added since then (in `20260703230113` and `20260726031512`) even assume `authenticated` can call it, so those policies are currently unreachable too.

## Fix

Single migration that restores the grant to `authenticated` (and keeps `service_role`, keeps `anon` revoked):

```sql
GRANT EXECUTE ON FUNCTION public.me_is_super_admin() TO authenticated;
```

No app-code changes required — `admin.index.tsx`, the Security posture card, and every policy that references the function will start working again the moment the grant lands.

## Verification after apply

1. Reload `/admin` → Organisations table shows Tier / Usage / Status columns and an **Admin details** button next to Positive Traction.
2. Click **Admin details** → firm page renders with the **Always free** switch in the Subscription section (this is the free-forever control you were looking for).
3. Reload `/admin/security` → Posture card renders MFA/session counts instead of the red permission-denied message.

## Not in scope

- No changes to billing UI (still hidden as agreed).
- No changes to `hasAdminAreaAccess`, sidebar, or route structure.
- Nothing else touched — this is a one-line grant.
