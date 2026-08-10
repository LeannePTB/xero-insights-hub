# Where client + subscription admin lives (and how to fix it)

## How it works today

- **Dashboard → "Open clients"** goes to the organisation page (`/firms/<id>`). That page already has a **New client** button in the top-right, next to the plan badges. On a narrow window it wraps under the org name, which is likely why it looked missing.
- **Removing a client** is only possible deep inside the client itself: open the client → Settings → bottom "Delete client". There is no remove action in the org's client list.
- **Subscription admin** exists only for super admins, at `/admin/firms/<id>` ("Admin details" from the Admin hub). It lets you set tier, status, trial end, next bill date and cancel-at-period-end. An organisation owner has no way to see their own plan beyond the small badges.

Current data: one organisation, "Positive Traction Clients" (Legacy, always-free, unlimited clients, 3 clients).

## What to change

### 1. Organisation page becomes the client admin
- Make **New client** a clear primary action that never hides on narrow screens (own row under the header on mobile), plus keep the empty-state button.
- Add a row action menu on each client in the table: **Open**, **Settings**, **Remove client** (confirm dialog, same delete server function already used in client settings).
- Show "x of y clients used" next to the button, and when at limit, explain the upgrade path instead of a silently disabled button.

### 2. Subscription visible and editable from the organisation
- Add a **Plan & subscription** card at the top of `/firms/<id>` showing tier, status, client usage, trial/next bill date.
- Super admins get an **Edit plan** button on that card that opens the same subscription editor already used on the admin detail page (tier, status, trial end, period end, cancel at period end, always-free).
- Non-super-admin org owners see the card read-only with a "Contact support to change plan" note.

### 3. Navigation clarity
- On the Admin hub organisations table, keep both actions but rename to **Clients** and **Plan & members** so it is obvious where subscription admin lives.

## Technical notes

- Files: `src/routes/_authenticated/firms.$firmId.tsx` (client list, add/remove, plan card), `src/routes/_authenticated/admin.firms.$firmId.tsx` (extract the existing `SubscriptionSection` into a shared component under `src/components/admin/` so both pages use one editor), `src/routes/_authenticated/admin.index.tsx` (link labels).
- Reuse existing server functions: `listClients`, `deleteClient`, `getMyFirm`, and the admin subscription update function; no schema changes.
- Removal keeps current semantics: deleting a client removes viewer access but leaves the Xero connection available to relink.
