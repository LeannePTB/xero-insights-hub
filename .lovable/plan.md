# Fix "Add client from Xero" creating a client for every Xero file

## What went wrong

When you authorise Xero, Xero returns **every** organisation that login has ever authorised — not just the one you ticked. The onboarding step takes that whole list and creates a client subscription for each one, which is why files like *Hay Officesmart Newsagency* were turned into clients in an organisation they don't belong to.

The state saved before the redirect already records which Xero files were known beforehand, but the callback ignores it.

## The fix

### 1. Only consider genuinely new authorisations
On return, compare the list Xero sends back against the files already known before the flow started. Files already known are never turned into new clients.

### 2. Always confirm before creating
Even with one new file, and certainly with several, don't create silently:
- Exactly one new file → create the client as today and land on its dashboard.
- More than one new file, or none new → land on a confirmation screen on the organisation page listing the authorised Xero organisations with tick boxes, defaulting to the new ones only. You pick, press **Create clients**, and only those are created.

Files already linked to another client, or beyond the plan's client limit, stay unselectable with the reason shown.

### 3. Clean up what was created by mistake
Remove the client subscriptions that this run created in error (including *Hay Officesmart Newsagency*) and unlink their Xero files, leaving the Xero authorisation itself intact so those files can be linked to the right organisation later. I'll confirm the exact list with you before deleting anything.

## Technical notes

- `src/routes/api/public/xero/callback.ts` (onboard branch): compute `newTenantIds = tenants − stateRow.known_tenant_ids`. Auto-create only when `newTenantIds.length === 1`; otherwise redirect to `/firms/$firmId?xero_pick=<state>` and keep the state row (mark `completed_at`, store `pending_tenant_ids`) instead of deleting it.
- `src/lib/xero/connections.functions.ts`: new `listOnboardCandidates` (reads the pending state, returns tenant name + status: new / already linked / no room) and `createClientsFromSelectedTenants` (firm-membership + capacity checks, then calls the existing `createClientsFromTenants` with the chosen subset, then deletes the state row).
- `src/lib/xero/onboard.server.ts`: `createClientsFromTenants` unchanged apart from accepting the filtered subset.
- `src/routes/_authenticated/firms.$firmId.tsx`: read the `xero_pick` search param and render a selection dialog wired to the two new server functions.
- Cleanup of the wrongly created clients is a data operation (delete `client_xero_orgs` rows then the `clients` rows), not a schema change.
