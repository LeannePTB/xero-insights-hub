# Why a disconnected Xero file doesn't disappear

## What's actually happening

There are two different "Disconnect" buttons, and they do different things.

1. **Disconnect on a client / organisation** (`disconnectXero`): tells Xero to drop the connection, revokes the refresh token, writes an audit row, then **deletes** the row. The file genuinely goes away.

2. **Disconnect on the "Unassigned Xero connections" card** (the one in your screenshot, `disconnectOrphanXeroConnection`): only **marks the row** `status = 'disconnected'` and clears the stored tokens. It:
   - keeps the row in the database,
   - never calls Xero, so Xero still lists Traction Advisory as a connected app for that organisation,
   - and the card's own list has **no status filter**, so the same row is still returned and rendered — just with a different badge.

That's why *Hay Officesmart Newsagency* stays on screen after you disconnect it.

## The fix

Make the unassigned-connections Disconnect behave exactly like the organisation one:

- Revoke at Xero first (best effort, never blocks): `DELETE /connections/{id}` and the identity-server token revocation, so the file stops showing our app as connected on Xero's side.
- Write the audit row (as it does now) **before** removal.
- Then delete the `xero_connections` row instead of flagging it, so the card empties immediately.
- As a belt-and-braces measure, filter out `status = 'disconnected'` rows from the unassigned list, so any pre-existing flagged rows from earlier disconnects also stop appearing.

Existing rows already sitting at `status = 'disconnected'` will disappear from the card as soon as the filter lands; nothing else references them.

## Technical notes

- `src/lib/xero/orphan-connections.functions.ts`
  - `disconnectOrphanXeroConnection`: reuse the revoke sequence from `disconnectXero` (`getConnectionByTenant`, `DELETE https://api.xero.com/connections/{id}`, `POST https://identity.xero.com/connect/revocation`), keep the `firm_id IS NULL` guard and super-admin check, then `.delete().eq('id', connectionId).is('firm_id', null)`.
  - `listOrphanXeroConnections`: add `.neq('status', 'disconnected')`.
- No shared helper exists for the revoke sequence today; it will be extracted into a small server-only helper so both paths use one implementation rather than a second copy.
- No schema change: no tables, columns, migrations, RLS policies, triggers or database functions.

## Invariants touched (section 0)

- **5 — tokens never leave the server**: revoke happens server-side only; nothing new is returned to the browser.
- **7 — one implementation per rule**: the revoke sequence becomes a single shared helper instead of duplicated logic.
- Access rules unchanged: still super-admin only, still restricted to connections with no organisation.
