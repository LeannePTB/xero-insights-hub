## Diagnosis

The Xero OAuth flow is actually succeeding. Server logs show the last two attempts returned `302 → /dashboard?xero=connected` (no errors), and the screenshot confirms the `Positive Traction` org now exists under **Link existing**.

What looks like a "silent fail" is a missing final step: when you click **Connect new** from inside a client's settings, the callback saves the Xero connection to your user, but it doesn't link that connection to the client you started from. It also redirects to `/dashboard` instead of back to the client settings page, so it looks like nothing happened.

## Plan

Make "Connect new" finish the job: auto-link the new org to the originating client and return the user there.

### Changes

1. **`xero_oauth_states` table** — add nullable `client_id uuid` column (migration). Stores which client (if any) initiated the connect.

2. **`startXeroConnect` (`src/lib/xero/connections.functions.ts`)**
   - Accept optional `clientId` in the input.
   - Persist it on the `xero_oauth_states` row.

3. **`handleConnect` (`src/routes/_authenticated/clients.$clientId.settings.tsx`)**
   - Pass `clientId` into `startConnect`.

4. **Callback (`src/routes/api/public/xero/callback.ts`)**
   - After the successful `xero_connections` upsert, if the state row had a `client_id`:
     - For each new tenant, upsert a row into `client_xero_orgs` (`client_id`, `xero_connection_id`) using `supabaseAdmin`, ignoring duplicates.
     - Enforce the same multi-company guard already in `attachXeroOrg` — if the client already has one org linked and isn't on the multi-company tier, skip the link and redirect with `?xero_error=multi_company_required` instead of silently dropping it.
   - Redirect target becomes `${returnOrigin}/clients/<clientId>/settings?xero=connected` when a `client_id` was set; otherwise keep the existing `/dashboard?xero=connected`.

5. **Settings page toast** — read `?xero=connected` from the URL on mount and show a "Xero org linked" toast plus invalidate `["client", clientId]` and `["xero-connections"]` so the new org appears immediately.

### Out of scope
- No changes to encryption, token storage, or scopes.
- No changes to the dashboard banner.

### Validation
- Connect a new org from client settings → land back on the same settings page with the org in **Linked**, not under **Link existing**.
- Connect from `/dashboard` (no `clientId`) → behaves exactly as today.
- Confirm the multi-company guard still blocks a second link for non-multi clients.
