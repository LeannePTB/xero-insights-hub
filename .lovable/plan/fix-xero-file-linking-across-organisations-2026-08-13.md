# Fix Xero file linking across organisations

## What the data shows

Nothing was actually unlinked. Current state in the database:

| Xero file | Stamped to organisation | Linked to client subscription |
| --- | --- | --- |
| Positive Traction | Positive Traction Clients | Positive Traction |
| Hay Officesmart Newsagency | Positive Traction Clients | Home Hunter Watch Pty Ltd |
| DRTABT Projects Pty Ltd | Positive Traction Clients | DRTABT Projects (client under Positive Traction Clients) |
| A.C.N. 657 659 026 Pty. Ltd. | DRTABT Projects | A.C.N. 657 659 026 Pty. Ltd |

The screenshot is the **new** client "DRTABT Projects Pty Ltd" inside the **DRTABT Projects** organisation. It has never had a file linked. The DRTABT Xero file it wants is still attached to the older "DRTABT Projects" client sitting in the Positive Traction organisation, so it shows as unavailable — and every other file is hidden because it belongs to a different organisation.

## Why it happens

1. **First connect wins, forever.** When a Xero login authorises several files at once, every file gets stamped with the organisation of whichever client started that connect. Later connects never re-stamp (the update only fills blanks), so a file is permanently owned by the first organisation that touched it.
2. **Hard filter, no escape hatch.** The picker only offers files stamped to this client's organisation. A file stamped elsewhere can never appear, so there is no way to move it — even for a super admin.
3. **Already-linked files are a dead end.** They render greyed out with no action, which reads as "the link disappeared".

## The fix

### 1. Move a Xero file between subscriptions
Advisors and super admins get a **Move here** action on any candidate that is already linked elsewhere. It shows which subscription currently holds it, asks for confirmation, then unlinks it there and links it here in one step (respecting the target's file allowance). Organisation owners/staff only get this for files inside their own organisation; cross-organisation moves are super-admin only.

### 2. Stop the sticky organisation stamp
A file's organisation follows its **link**, not the first connect:
- Linking a file to a client re-stamps it with that client's organisation (already happens).
- Unlinking clears the stamp so the file is free for any organisation again.
- The picker offers files stamped to this organisation, files with no stamp, and — for super admins — files stamped elsewhere, clearly labelled with the organisation and subscription that holds them.

### 3. Clearer picker
Each row states its situation plainly: *Available*, *Already on this subscription*, or *On <subscription> in <organisation>* with the Move action. When nothing is available and nothing is movable, the message says which subscription is holding the file rather than a generic error.

### 4. Clean up the current data
Move the **DRTABT Projects Pty Ltd** Xero file to the "DRTABT Projects Pty Ltd" client in the DRTABT Projects organisation, and delete the now-empty duplicate "DRTABT Projects" client from the Positive Traction organisation (it exists only because of this bug). Confirm before this runs if you'd rather keep that client.

## Technical notes

- `src/lib/xero/client-orgs.server.ts`: `getSelectableConnectionsForClient` gains the caller's user id, returns `movable`, `linkedClientId`, `linkedFirmName` alongside `available`; firm filter widened to `firm_id = client firm OR firm_id is null OR caller is super admin`.
- `src/lib/xero/connections.functions.ts`: new `moveXeroFileToClient` server fn (`requireSupabaseAuth`) — verifies manage rights on both source and target client, enforces target allowance, deletes the source `client_xero_orgs` row and inserts the target row, re-stamps `xero_connections.firm_id`, writes an `audit_log` entry (`xero_file_moved`). `linkClientXeroOptions` accepts movable candidates when the caller is authorised.
- Existing unlink path clears `firm_id` on the connection.
- `src/routes/_authenticated/clients.$clientId.settings.tsx`: candidate rows render status text plus a **Move here** button with a confirm dialog.
- Data cleanup runs as a migration: repoint the DRTABT `client_xero_orgs` row, remove the orphan client row.
- No schema changes.
