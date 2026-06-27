## Root cause

The advisor invite UI already exists and works — it's at `/settings/advisors` (`src/routes/_authenticated/settings.advisors.tsx`) with full Invite / Create-with-password / Resend / Revoke flows wired to the `inviteAdvisor` / `createAdvisorWithPassword` / `resendAdvisorInvite` / `revokeAdvisor` server functions.

You have permission to use it — your account holds both `advisor` and `super_admin` roles, so the `assertAdvisor` check passes.

**The problem is purely navigation**: a `grep` for `/settings/advisors` across `src/` returns only the route file itself and the auto-generated route tree. There is no link, button, or menu item anywhere in the app pointing at it. The Super-admin header in `src/routes/_authenticated/admin.index.tsx` only exposes "Tier widgets", "Security", and "Invite organisation".

About the "2" in the audit log: those are the two existing advisor role grants for `admin@positivetraction.com.au` and `allyce@positivetraction.com.au` (confirmed in `auth.users` joined with `user_roles`). The audit-log count is correct — it just reflects accounts already created, not pending invites.

## Fix

Add a single entry point to the existing page from the Super-admin header so it sits alongside Tier widgets / Security / Invite organisation.

**Edit `src/routes/_authenticated/admin.index.tsx`** — header action bar (around line 71–80):

- Add a new button (advisors-only, since the route already requires advisor):
  ```tsx
  <Button asChild variant="outline" size="sm">
    <Link to="/settings/advisors"><Users className="h-4 w-4 mr-2" />Advisors</Link>
  </Button>
  ```
- Import `Users` from `lucide-react` alongside the existing icon imports.

That's the entire change — no schema, server-function, or permission work is needed because the page and all its mutations already exist and your role already authorises them.

## Verification

After the edit I'll confirm the build succeeds and that the Admin header renders a new "Advisors" button next to "Security", landing on the existing invite/manage UI.