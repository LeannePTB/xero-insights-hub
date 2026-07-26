The Security & Compliance page still exists at `/admin/security`, but the admin experience is currently a flat header with a single Security button. The user wants a proper admin area that groups Security, Tier widgets, New client and Advisors in one place.

## Plan

### 1. Create an admin shell with sidebar
- New `src/components/admin/AdminShell.tsx` that renders a collapsible `Sidebar` (from `src/components/ui/sidebar.tsx`) plus an `Outlet` area.
- New `src/components/admin/AdminSidebar.tsx` with navigation items:
  - **Organisations** → `/admin`
  - **Security & Compliance** → `/admin/security`
  - **Tier widgets** → `/settings/tiers`
  - **New client** → `/clients/new`
  - **Advisors** → `/settings/advisors`
- Highlight the active route using `useRouterState` and TanStack `Link`.
- Include a mobile header with `SidebarTrigger` so the menu is usable on small screens.

### 2. Convert admin routes to use the shell
- Update `src/routes/_authenticated/admin.tsx` from a plain `<Outlet />` layout to render `<AdminShell />`.
- Remove the per-page back/Security buttons from `src/routes/_authenticated/admin.index.tsx` (the shell now provides navigation).
- Update `src/routes/_authenticated/admin.security.tsx` to render inside the shell (remove its own Admin back button).
- Optionally update `src/routes/_authenticated/admin.firms.$firmId.tsx` so the firm detail page also uses the shell for consistency.

### 3. Keep dashboard entry point
- Leave the **Admin** button on `src/routes/_authenticated/dashboard.tsx` for super-admins; it continues to route to `/admin`.
- Non-super-advisors still see their existing dashboard buttons (Tier widgets, My account, New client).

### 4. Verify
- Type-check the changes.
- Use the preview to confirm:
  - Super-admin sees the Admin button on the dashboard.
  - `/admin` loads with the new sidebar and all five nav items.
  - Clicking **Security & Compliance** loads `/admin/security` with the shell still visible.
  - Mobile view shows the sidebar trigger.

## Out of scope
- No route moves: `/settings/tiers`, `/settings/advisors` and `/clients/new` keep their existing URLs; the admin sidebar simply links to them.
- No role changes: the Admin area remains super-admin only.