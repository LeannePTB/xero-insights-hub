# Why the dashboard only shows one subscription

## What I checked

- You are signed in as a super admin, and the dashboard already loads **every** organisation for super admins (not just your own).
- The database currently contains **one** organisation: "Positive Traction Clients" (Legacy, always free, 3 clients), with exactly one subscription row.

So the page is not filtering anything out — the organisation you tried to add with "Add later" was never actually created. No second firm or subscription row exists, and no failure is visible in the UI after the fact.

The cause of the failed creation is not yet confirmed (the create path itself looks correct), so step 1 is to reproduce it.

## Plan

1. **Reproduce the add-organisation flow** end to end in the preview as super admin using the "Add later" (no owner) option, and capture the exact error or silent failure.
2. **Fix whatever the reproduction shows.** Likely candidates to harden regardless:
   - Surface server errors from the create dialog as a visible error message inside the dialog, not just a toast that can be missed.
   - Keep the dialog open on failure so the entered details aren't lost.
   - Refresh the organisations list on the Admin hub and the dashboard immediately after a successful create.
3. **Make the dashboard read as a list, not a single plan.** When you are a super admin, the heading should always be "Subscriptions" with a count, even when only one organisation exists, so it is obvious the page is showing everything rather than just your own firm. Add a short line stating whether you're viewing all organisations (super admin) or only your own.
4. **Add an empty/one-org affordance**: an "Add organisation" button on the dashboard for super admins so a new subscription can be created from where you notice it's missing.

## Technical notes

- Files: `src/routes/_authenticated/dashboard.tsx` (heading, count, admin add button), `src/routes/_authenticated/admin.index.tsx` (dialog error handling + query invalidation), `src/lib/invites.functions.ts` (only if the reproduction shows a server-side fault).
- No schema changes; `listFirmsForSuperAdmin` already returns all firms.
