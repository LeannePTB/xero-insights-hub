## Problem

The trash icon on a linked Xero org calls `detachClientXero` — it only removes the link between the client and the connection. The underlying `xero_connections` row (with the stale/expired refresh token) is untouched, so the same connection reappears in "Link existing" and re-linking it does NOT reauthorize with Xero. Nothing actually refreshes the tokens, which is why widgets keep saying "this connection needs to be reconnected".

To recover from a broken token, we need to re-run the Xero OAuth flow — that's the only thing that issues new tokens. The callback already upserts on `(user_id, tenant_id)`, so re-authing will overwrite the bad tokens in place.

## Plan

### 1. `src/routes/_authenticated/clients.$clientId.settings.tsx` — Xero organisations section

Replace the single trash icon per linked org with two explicit actions:

- **Reconnect** (refresh icon) — calls `startXeroConnect({ origin })` and redirects to the returned `authorizeUrl`. After the user re-approves in Xero, the existing callback upserts fresh tokens for the same `tenant_id` and bounces back to the dashboard. No DB changes needed.
- **Disconnect** (trash icon) — opens an AlertDialog with two choices:
  - *Unlink from this client* → existing `detachClientXero` behaviour (connection stays available to link elsewhere).
  - *Disconnect from Lovable entirely* → calls `disconnectXero({ tenantId })`, which deletes the `xero_connections` row. Use the org's `tenant_id` (already available via `o.xero_connections.tenant_id`).

Invalidate `["xero-connections"]` and the client query after each action so the lists refresh.

Add a small helper text under the section header: "If a widget says Xero needs reconnecting, use Reconnect — it re-runs Xero sign-in and refreshes the tokens in place."

### 2. No server / DB changes

`startXeroConnect`, the `/api/public/xero/callback` upsert, and `disconnectXero` already do the right thing. The fix is purely surfacing the missing reconnect action in the UI and making the destructive action explicit.

## Verification

1. From client settings, click **Reconnect** on the broken org → redirected to Xero → approve → land back on `/dashboard?xero=connected` → widget loads.
2. Click **Disconnect → Unlink** → org disappears from "Linked" and shows under "Link existing".
3. Click **Disconnect → Disconnect entirely** → org disappears from both lists; reconnecting requires a fresh OAuth.
