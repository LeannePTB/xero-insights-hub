## Goal
Restore clear Admin access for super-admin users and make the admin area reachable from the screen shown in your screenshot.

## What I confirmed
- The dashboard currently only shows the **Admin** button when `getMyContext()` returns `isSuperAdmin: true`.
- The screenshot shows the regular advisor buttons (**Tier widgets**, **My account**, **New client**) and no **Admin**, so the UI is not treating the current login as super-admin.
- The Admin pages still exist at `/admin` and `/admin/security`; the missing part is access/visibility for your current user.

## Plan
1. **Fix the dashboard entry point**
   - Show the **Admin** button for any user who is either:
     - a true `super_admin`, or
     - has admin-level firm/advisor access already used elsewhere in the app.
   - Keep normal advisor buttons visible as needed, so you do not lose **Tier widgets**, **My account**, or **New client**.

2. **Make Admin navigation obvious**
   - Ensure the Admin button routes to `/admin`, where the sidebar contains:
     - Organisations
     - Security & Compliance
     - Tier widgets
     - New client
     - Advisors

3. **Harden the role check**
   - Update the context function so admin visibility is based on the backend role/access data, not a fragile UI assumption.
   - If the current user is missing the required backend `super_admin` role, surface a clear “not super-admin” state rather than silently hiding Admin.

4. **Verify**
   - Confirm the dashboard shows **Admin** for the appropriate user.
   - Confirm `/admin` and `/admin/security` load with the admin sidebar.

## Out of scope
- No changes to client financial-data permissions.
- No changes to MFA, login, or Xero connection logic.