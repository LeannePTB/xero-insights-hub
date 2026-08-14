# Keep Xero file lists inside the organisation

## What's happening

On a client's settings page the "Choose files for this subscription" list is showing Xero files belonging to other organisations (Positive Traction, DRTABT Projects) while you're working inside a different organisation.

Two reasons, both confirmed in the code:

1. The picker's organisation filter is skipped entirely for super admins — they see every file the Xero login authorised, stamped to any organisation.
2. "Move here" is offered on those out-of-organisation files, so a file can be pulled across organisations from the picker.

Separately, the "Xero organisations" list on the page relies only on row-level security, which is not organisation-scoped for advisors.

## The fix

### 1. One rule for everyone: same organisation only
The picker only ever offers files that are stamped to this client's organisation, or not stamped to any organisation yet. This applies to advisors, organisation owners/staff and super admins alike, so nothing outside the organisation is ever listed — no greyed-out rows naming other clients, no "Move here" across organisations.

Result for the screenshot: only *Hay Officesmart Newsagency*, *TracyFinlay* and any file already inside this organisation would appear.

### 2. Moves stay inside the organisation
"Move here" remains, but only between subscriptions of the same organisation. A cross-organisation move is rejected server-side, not just hidden in the UI.

### 3. Organisation list scoped too
The list of connected Xero organisations shown in settings and elsewhere is filtered to the organisation the caller is working in, so an advisor sitting in one organisation cannot see another's connected files.

### 4. Clearer empty state
When the authorisation returned files but none belong to this organisation, say so plainly: "Those Xero files belong to another organisation" rather than showing them.

## Technical notes

- `src/lib/xero/client-orgs.server.ts` → `getSelectableConnectionsForClient`: remove the `superAdmin ? true : …` bypass; scope is always `firm_id = client firm OR firm_id IS NULL`. `movable` becomes `link && !linkedToThisClient && link.firmId === firmId`. The `callerUserId` / `isSuperAdmin` branch is no longer used here.
- `src/lib/xero/connections.functions.ts`:
  - `moveXeroFileToClient` (and the `move_xero_file_to_client` DB function's caller path): assert source client's `firm_id` equals target client's `firm_id`; throw otherwise.
  - `listXeroConnections`: filter by the caller's firm memberships (via `client_xero_orgs → clients.firm_id` and `xero_connections.firm_id`) instead of returning everything RLS allows.
- `src/routes/_authenticated/clients.$clientId.settings.tsx`: adjust the empty/none-available copy for the new case.
- No schema changes and no data changes.
