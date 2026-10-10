# Navigation restructure — Steps 1 and 2

**Security classification: SECURITY-RELEVANT.** This work touches the admin area, role-based menus, public routes (redirects), the admin client (member support tools) and a new platform table. No access rule changes. Every route keeps its current server-side guard.

## Step 1 — Menu foundation

### What you will see
- One left-hand menu for everyone except client viewers. Owners and staff now get it too.
- A **workspace switcher** at the top of the menu. It lists "System Admin" (super admins only) and each organisation you belong to. The workspace you choose sets which menu appears.
- Opening a client shows that client's own sub-menu: Dashboard, Reports, Cash flow scenario, Loans, Payables/Receivables and Client settings.
- Labelled groups. Parent items expand to show sub-items, and the parent opens by itself when you are on one of its pages. Items can show optional counts. The menu collapses to icons, and on mobile it closes after you pick a page.
- My account and Sign out sit at the bottom of the menu. Client viewers keep today's simple header with Sign out.

### Menus (defined in code, structured so they could move to the database later)
```text
System Admin    Organisations · Plans & catalogue* · Platform staff · Platform branding
                Security & Compliance · Xero monitoring
Organisation    Overview · Clients · Xero files
                Consolidations ▸ Groups · Loan matrix · Loan accounts
                People & access · Settings
Client          Dashboard · Reports · Cash flow scenario · Loans
                Payables / Receivables · Client settings
```
*Plans & catalogue only links to the screens that exist today. No new editor in these steps.

### How the workspace is chosen
- The page address decides it: `/system/*` is System Admin, `/firms/:firmId/*` is that organisation, and `/clients/:clientId/*` is the client sub-menu inside its organisation.
- The switcher only moves you to another address. Nothing about the workspace is stored in the browser. Local storage keeps one thing only, whether the menu is collapsed, as it does today.
- Who sees which entry comes only from `getMyContext`: `isSuperAdmin` shows System Admin, and `firmIds`/memberships list the organisations. Organisation names come from the existing caller-scoped membership function. TypeScript never looks up roles itself.

### Files
- **Create**
  - `src/components/shell/AppShell.tsx`: provider, sidebar, inset, header trigger. Keeps the non-shrinking spacer and `min-w-0` rule from AGENTS.md.
  - `src/components/shell/AppSidebar.tsx`
  - `src/components/shell/WorkspaceSwitcher.tsx`
  - `src/lib/nav/sidebar-nav.ts`: menu data, plain JSON-like items with `{id, label, icon, to, params, children, badgeKey, requires}`.
  - `src/lib/nav/workspace.ts`: works out the workspace from the address, plus a pure active-item matcher.
  - `src/lib/nav/sidebar-nav.test.ts`: tests for active/parent expansion and for "System Admin only when isSuperAdmin".
- **Change**
  - `_authenticated/route.tsx`: render `AppShell` when the person is a super admin, practice member or organisation member. Otherwise render the bare layout. Delete `ownsAdminMenu`.
  - `_authenticated/admin.tsx`: becomes a plain `<Outlet />` until Step 2 moves it.
  - `AppHeader.tsx`: delete the DOM check. It takes a `showSignOut` setting instead, and only the bare layout uses it.
  - `GlobalSignOut.tsx`: shown only in the bare layout. No DOM sniffing.
  - Business Hub patterns get ported. I will read its three reference files through cross-project search before building.
- **Delete:** `AdminShell.tsx`, `AdminNavShell.tsx`, `AdminSidebar.tsx`. The collapse-memory hook moves into AppShell with the same key.

### Guards preserved
- No change to any server function, policy or definer function.
- Each route's `beforeLoad` and server-side checks stay exactly as they are. Hiding a menu item is cosmetic. Opening a URL directly still hits the same guard.

## Step 2 — System Admin area

### Routes and redirects
| New | Replaces (redirect, permanent) |
|---|---|
| `/system` (Organisations table) | `/admin` |
| `/system/organisations/:firmId` (platform controls) | `/admin/firms/:firmId` |
| `/system/security` | `/admin/security` |
| `/system/xero` (usage, errors, orphan connections) | the cards that currently sit on security/admin pages |
| `/system/staff` ("Platform staff") | `/settings/advisors` and `/settings/practice-team` |
| `/system/branding` | new |

- Files go under `src/routes/_authenticated/system.*.tsx` with a `system.tsx` layout. The layout's `beforeLoad` calls the existing super-admin server check (`assert_super_admin` through a server function). That is defence in depth: every page's server functions keep their own `assertSuperAdminDb`.
- Old route files become `beforeLoad: redirect(...)` stubs, so bookmarks and links in emails keep working.
- `/system/organisations/:firmId` gets: the purchase editor (`OrgPurchaseCard`), `BillingLifecycleCard`, member support tools (reset password, change email), View As, `AuditMonitoringCard`/the audit log, `SupportAccessCard` (the super-admin side), and the organisation's Xero file metadata. It shows no client figures.
- Parts of today's firm page that are organisation-run (clients, consolidation groups, transfer ownership) stay on `/firms/:firmId/...`.
- **Flagged, not moved:** `OrgCardDefaultsCard` stays reachable on the System organisation page. It will move to Organisation Settings in a later step.

### Platform branding
- A new page at **System Admin, Platform branding** with: product name, logo for light and dark backgrounds, favicon and email sender name.
- These are used by the header, sidebar, `BrandMark`, the sign-in, signup, set-password, security and shared-report pages, the report PDF, and the sender name in emails.
- If nothing is set, everything falls back to today's bundled files and "Traction Advisory".
- The PDF and email templates get a read-only check first. I will list every place the brand is hard-coded before changing any of them.

### Database changes (one migration)
- `public.platform_branding`: a single row (`id boolean primary key default true check (id)`, product_name, logo_light_path, logo_dark_path, favicon_path, email_sender_name, updated_at, updated_by).
  - `revoke all from anon, authenticated`. There are **no direct grants** and RLS is on with no permissive policies.
  - This is not organisation or client data, but it still stays deny-by-default.
- `public.get_platform_branding()`: a definer function, `SET search_path`, that returns only those display fields.
  - EXECUTE is granted to `anon, authenticated`, because the sign-in page shows the logo before anyone signs in. It needs no aal2 because it returns public brand metadata only.
  - This is a documented exception in the definer register.
- `public.save_platform_branding(...)`: a definer function. It runs `assert_aal2()` and the super-admin check first, takes no user-id parameter, writes an audit row in the same transaction, and has EXECUTE revoked from PUBLIC and anon.
- A storage bucket `platform-branding`. Its files are publicly readable because logos are public. Uploads go through a server function that checks aal2 and super admin, checks the file type and size, and uses the existing admin-client upload pattern. That use goes into the admin-client register.
- The existing `app_private.platform_settings` (key/value) is **not** reused. It holds internal switches and must stay private.
- Matrix rows, fixture, definer register and RPC signatures all get updated.

### Flagged only (no fix in these steps; added to the backlog)
1. `PRIMARY_ADVISOR_USER_ID` is hard-coded in `advisors.functions.ts` and `settings.advisors.tsx`. This is a who-can-do-what rule living in TypeScript, which breaks invariant 6.
2. `getMyContext` sets `isAdvisor` and `hasAdminAreaAccess` for any organisation member. The menu in Step 1 will **not** use those flags. It uses `isSuperAdmin`, `isPracticeMember` and memberships, so the confusion doesn't spread.

## Conflicts with the security docs
- **Invariant 3 / path C:** System Admin must never show client figures. The Overview link for practice-team members moves to the Organisation workspace, not System Admin.
- **Invariant 1:** a public read for branding would be `USING (true)`. That is avoided by the definer function above. It needs your sign-off as a new anon-callable function. **Please confirm.**
- **Invariant 7:** member support tools (reset password, change email) and the branding upload use the admin client. The existing register entries move with their files, and the upload is added as a new entry.
- **Access paths:** nothing changes for any role. Showing the menu to organisation members is presentation only, and they can already open those pages.
- **"Dashboard removed — do not re-add"** (project memory): the client sub-menu's "Dashboard" is the existing client live dashboard, not the removed `/dashboard` landing page. **Please confirm** that label is fine, or we could call it "Live Dashboard" to match the page switch.

## Verification after each step
- `bun run security:check` (known-failure list unchanged), `tsgo`, build log and the linter. There should be no new Warn or Action.
- New nav tests, plus redirect tests for every old URL.
- A security report and a backlog update in the same change.
- Visual check: I can't sign in to check pages myself because the test account's second-factor step blocks me, so I will ask you to click through each workspace.
