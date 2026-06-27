Implementing checkpoints 2 (proper disconnect), 3 (handle Xero-initiated disconnects), and 4 (branding) from the gap analysis. Skipping Sign Up / Sign In with Xero for a later pass.

## 1. Disconnect that actually revokes at Xero

`src/lib/xero/connections.functions.ts` → update `disconnectXero` to:
1. Load the current row (need `id`/connection-id, access + refresh tokens).
2. Decrypt the access token, call `DELETE https://api.xero.com/connections/{connectionId}` with `Authorization: Bearer <access>`. Treat 401/404 as already-gone.
3. Call `POST https://identity.xero.com/connect/revocation` with `token=<refresh_token>` and HTTP Basic `client_id:client_secret`.
4. Delete the local `xero_connections` row (existing behaviour).
5. Audit-log a `xero_disconnected` row in `audit_log`.
6. If access token is expired, refresh first via the existing helper in `api.server.ts` before step 2; if refresh fails, skip remote revoke and still clean up locally.

Wrap remote calls in try/catch so a Xero outage never blocks the local cleanup, but log failures.

## 2. Handle Xero-initiated disconnects (status surfacing)

Schema (migration):
- Add columns to `xero_connections`: `status text not null default 'connected'` (`'connected' | 'disconnected'`) and `disconnected_at timestamptz`.

`src/lib/xero/api.server.ts`:
- In the shared fetch wrapper, when Xero returns 401 / `invalid_grant` / `unauthorized_client` after a refresh attempt, update the row to `status='disconnected', disconnected_at=now()` via `supabaseAdmin` before throwing the existing "reconnect required" error.

`src/lib/xero/connections.functions.ts`:
- `listXeroConnections` already selects connection metadata — add `status`, `disconnected_at` to the select.
- On a successful token refresh or fresh OAuth callback, reset `status` back to `'connected'` and clear `disconnected_at`.

`src/routes/_authenticated/clients.$clientId.settings.tsx`:
- Render a red "Disconnected — reconnect required" badge when `status === 'disconnected'`, with the existing Reconnect button highlighted.
- Existing green/blue badge keeps showing when `status === 'connected'`.

## 3. Branding polish (Checkpoint 4)

Add Xero-branded buttons used wherever we connect or disconnect:

- New `src/components/xero/ConnectWithXeroButton.tsx` — renders the official "Connect to Xero" blue button per Xero's branding guidelines (SVG mark + "Connect to Xero" / "Disconnect from Xero" / "Reconnect to Xero" label, correct colours `#13B5EA` blue and white text, min 32px height, proper padding, accessible focus ring). Variant prop: `connect | disconnect | reconnect`.
- Replace the current plain shadcn `Button` for Xero connect / reconnect / disconnect in:
  - `src/routes/_authenticated/clients.$clientId.settings.tsx`
  - any banner in `XeroConnectionBanner` (if it uses a generic button)
- Confirm the app name in `My Apps` matches the go-to-market name (this is a Xero portal action, not code — call it out in the response, not in the build).

Asset: inline the Xero "X" SVG inside the component so we don't depend on an external file.

## Technical details

- Network calls in `disconnectXero` use `fetch` directly inside the handler (Worker-safe).
- The new `status` column requires a `GRANT`-respecting migration; `xero_connections` already has grants — only `ALTER TABLE ... ADD COLUMN` is needed, no new GRANT block.
- All token decryption uses existing `decryptTokenB64` in `crypto.server.ts`.
- Audit log uses the existing `audit_log` table with `action='xero_disconnected'`, `target_type='xero_connection'`, `target_id=tenant_id`.

## Out of scope (explicit)

- Sign Up / Sign In with Xero (Checkpoint 1) — separate larger piece.
- Error log page (Checkpoint 6 nice-to-have).
- Data-integrity audit (Checkpoint 7) — flagged for a later pass.