# Add clients from the admin organisation page

## What's happening

There are two organisation pages, and only one of them has clients on it.

- **Plan & members** (`/admin/firms/<id>`) — the page you land on from the admin list. It has Subscription, Members and Audit log. No clients, so no way to add one.
- **The organisation page** (`/firms/<id>`) — has the Plan & subscription card, the Clients table, and the **New client** button, plus per-client Settings / View as / Remove.

So the button exists, just not on the page you were on.

## The fix

Bring clients onto the admin organisation page so a super admin can run the whole setup from one place.

- Add a **Clients** section to Plan & members, below Subscription, listing each client with its linked Xero files and granted tiers.
- Each row gets the same actions as the other page: **Open**, **Settings** (report basis, cost classification, Xero files, notes), **View as** the client tier, and **Remove**.
- A **New client** button at the top of that section, pre-scoped to this organisation, disabled with a note when the plan's client limit is reached.
- Keep the "no client data" rule: names, tiers and Xero file names only — no financial figures on this admin page.
- Add a link from Plan & members to the full organisation page for anything not duplicated.

## Technical notes

- `src/routes/_authenticated/admin.firms.$firmId.tsx` gains a Clients card reusing the query and row markup from `src/routes/_authenticated/firms.$firmId.tsx` (`listFirmClients`, tier settings, `enabledTiers`, delete mutation), extracted into a shared `FirmClientsSection` component so both pages stay in sync.
- Limit check uses the same `plan.clientCount >= plan.clientLimit` derived from `client_limit_override` / `plan_levels`.
- New client link: `/clients/new` with `search={{ firmId }}` as today.
