# Fix connecting Xero files to a client subscription

Two problems today:

1. When Xero says a file is "Already connected" (that Xero login authorised it for this app before), the app throws it away and shows "No newly authorised Xero organisation was available for this subscription."
2. The list of files the app offers is scoped to *the person who connected*, not to the organisation — so one login's other Xero files can appear where they shouldn't.

## What changes

### 1. Always let you pick from a list
After returning from Xero, the app takes **every** organisation that authorisation grants access to — not just brand-new ones — and shows a picker on the client's settings page:

- Files not yet linked to any client: selectable.
- Files already linked to another client subscription: shown greyed out with "Linked to another subscription" so it's obvious why they're unavailable, instead of silently vanishing.
- If exactly one file is selectable and there's allowance left, it auto-links as it does now.

This removes the "no newly authorised organisation" dead end for "Already connected" files.

### 2. Scope files to the organisation, not the person
Xero connections get stamped with the organisation (firm) they were connected for, and every list is filtered by that organisation:

- Connecting from a client's settings tags the resulting connections with that client's organisation.
- The picker only offers connections belonging to that same organisation (platform admins connecting on a client's behalf are treated as acting for that organisation, so their own unrelated files never appear).
- Existing connections get a one-off backfill: each connection already linked to a client inherits that client's organisation; anything unlinked stays with its connecting user and is only visible to them.

So an organisation's own users can never see Xero files outside their organisation — either in the picker or in any settings list.

### 3. Clearer messages
- If Xero returns no organisations at all for the authorisation, say so plainly and suggest re-running "Connect a Xero file" and ticking the right organisation on Xero's consent screen.
- If everything available is already linked elsewhere, say that instead of a generic error.

## Technical notes

- `src/routes/api/public/xero/callback.ts`: drop the `known_tenant_ids` "newly authorised only" filter for candidate selection; set `pending_tenant_ids` to all tenants from this authorisation's `/connections` response; set `firm_id` on upserted `xero_connections` rows from the initiating client's firm.
- `src/lib/xero/client-orgs.server.ts`: replace `getUnassignedConnectionsForUser` with a firm-scoped `getSelectableConnectionsForClient(clientId, tenantIds)` returning each candidate plus a `linkedToOtherClient` flag and the linked client's name.
- `src/lib/xero/connections.functions.ts`: `listClientXeroOptions` / `linkClientXeroOptions` use the new firm-scoped helper; `listXeroConnections` filters by the caller's firm membership (super admins unrestricted).
- Client settings page: render unavailable candidates as disabled rows with a reason.
- Migration: add `firm_id` backfill for `xero_connections` from `client_xero_orgs` → `clients.firm_id`. No new tables.
