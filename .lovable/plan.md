## Goal
Restructure the main dashboard into a two-level flow so a SaaS-style hierarchy is obvious: the landing view lists the firms (organisations) the signed-in advisor belongs to, and opening a firm shows only that firm's clients (companies with Xero connections).

## Current behaviour
- `/_authenticated/dashboard` shows all clients across every firm the advisor belongs to in one flat grid.
- Firm cards already exist for super-admins only, and a firm detail page already exists at `/_authenticated/firms/$firmId`.

## New behaviour
1. **Dashboard landing (`/dashboard`) — firms grid for everyone**
   - Advisors and super-admins both see a "Organisations" grid of the firms they can access.
     - Advisor: firms from `listMyFirms` (their memberships).
     - Super-admin: keep `listFirmsForSuperAdmin` so all firms show with own-firm first, others read-only.
   - Always show the grid, even when the advisor belongs to a single firm (no auto-open).
   - Each card shows firm name, plan/tier badge, and client count. Click → `/firms/$firmId`.
   - Client viewers (non-advisor) keep the existing behaviour: their assigned dashboards list, with the one-client auto-redirect.

2. **Firm detail (`/firms/$firmId`) — that firm's clients**
   - Reuse the existing route as the "clients inside a firm" view.
   - Header: firm name + Back to organisations.
   - Body: the client cards currently rendered on the dashboard (Business Health badge, tier rows, viewers assigned line), scoped to `firm_id = firmId`.
   - "New client" button lives here (create client inside this firm), not on the dashboard.
   - Advisor-only actions stay gated to firm members; super-admins viewing another firm see read-only cards (no financial detail beyond what already renders).

3. **Client detail (`/clients/$clientId`)** — unchanged. Already shows the client's connected Xero organisations and dashboards.

## Implementation notes (technical)
- `src/routes/_authenticated/dashboard.tsx`
  - Remove the flat clients grid for advisors. Render `FirmGrid` for both `isAdvisor` and `isSuperAdmin`, sourced from `listMyFirms` (advisor) or `listFirmsForSuperAdmin` (super-admin).
  - Keep the viewer branch and the single-client auto-redirect.
  - Remove the "New client" empty-state CTA from this page.
- `src/lib/clients.functions.ts` — add/confirm a `listClientsByFirm({ firmId })` server fn (membership-checked) so the firm page fetches only that firm's clients. If `listClients` already supports a firm filter, reuse it.
- `src/routes/_authenticated/firms.$firmId.tsx`
  - Fetch firm via `getMyFirm` and clients via `listClientsByFirm`.
  - Render the existing client-card layout (health badge, tier rows) previously on the dashboard.
  - Add a "New client" button that routes to `/clients/new?firmId=...` so the new client is created inside the current firm.
  - Include a "Back to organisations" link to `/dashboard`.
- `src/routes/_authenticated/clients.new.tsx` — accept an optional `firmId` search param and pre-select that firm.
- Header buttons on `/dashboard` stay as: Admin (when `hasAdminAreaAccess`), My account, Sign out. No "New client" at the top level.

## Out of scope
- No changes to Business Health scoring, Xero data widgets, tier settings, or auth.
- No renaming of the `firms` / `clients` tables or roles.
- No billing/subscription UI changes.
