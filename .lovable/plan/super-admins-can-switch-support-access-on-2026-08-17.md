# Super admins can switch Support access on

Today the Support access switch is owner-only: a platform super admin sees the card read-only and has to wait for the organisation owner to turn it on. This lets any super admin turn support access on (or off) for any organisation themselves, with a clear record of who did it.

## What changes

- On an organisation's Support access card, super admins get the same working switch the owner has.
- The card labels who granted access, so an owner can see when it was a Traction Advisory super admin rather than themselves.
- Turning it on immediately lets every super admin open that organisation's client data (dashboards, Xero-backed widgets, consolidations) — the existing rule that grants access to all platform staff once support access is on stays as-is.
- Every grant/revoke keeps writing to the organisation's audit log, including the super admin's name.
- Advisors who are not super admins keep the current read-only view.

## Technical notes

- Database migration on `public.firm_support_access`: extend the INSERT and UPDATE policies from owner-only to `owner OR app_private.is_super_admin(auth.uid())` (the SELECT policy already allows super admins).
- `setSupportAccess` in `src/lib/support-access.functions.ts` writes through the caller's session, so the policy change is what enables it; update its error message to say "Only the organisation owner or a Traction Advisory super admin can change support access."
- `getSupportAccess` returns a new `canManage` value of `isOwner || isSuperAdmin` (super admin resolved from the existing `user_roles` lookup already in the handler). Keep a separate flag so the card can note when the viewer is managing as platform staff.
- `SupportAccessCard.tsx`: render the switch when `canManage`; when the viewer is a super admin and not the owner, show a short "Super Admin View" style note above the switch consistent with existing super-admin markers.
- The existing `firm_support_access_audit()` trigger already logs changes; no change needed there.
