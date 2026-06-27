## What's happening

All cards on the Positive Traction dashboard fail with "This Xero data could not load right now."

Looking at the database, the Xero connection for Positive Traction:
- Access token expired on **2026-06-22** (5 days ago)
- Has only the legacy plaintext token (no encrypted token from the security upgrade)
- Hasn't been touched since 2026-06-22 06:56 UTC

When any widget loads, the server tries to refresh the access token using the stored refresh token. Refresh is failing — almost certainly because the refresh token has been invalidated (Xero rotates the refresh token on every use, and if anything used it once during the last 5 days the old one stored here is dead). That triggers the generic "could not load" message on every card.

## Fix

The token store can't recover itself — Xero requires the user to reconnect the org via OAuth. The widgets are doing the right thing by failing fast; what's missing is a clear, actionable path on screen instead of the generic message.

### Step 1 — Confirm the refresh is the problem
- Call the existing connection-status server fn from the dashboard once on mount for Positive Traction and log the precise refresh error to server logs so we can confirm `invalid_grant` vs scopes vs network.

### Step 2 — Surface a "Reconnect Xero" CTA on the dashboard
- In `src/routes/_authenticated/clients.$clientId.index.tsx`, when **all** widget queries return a Xero auth-class error (refresh failed / 401 after refresh), render a single banner above the cards: "Xero connection for Positive Traction needs to be reconnected" with a **Reconnect** button that kicks off the existing PKCE OAuth flow in `src/lib/xero/connections.functions.ts`.
- Keep individual card error states for non-auth failures (rate-limit, timeout, etc.) using the existing `friendlyXeroError` mapping.

### Step 3 — Detect auth-class failure precisely
- In `src/lib/xero/api.server.ts` `refreshAccessToken`, when Xero returns `invalid_grant` / `invalid_client`, throw a tagged error (`XeroReconnectRequired`) instead of the raw body. `friendlyXeroError` already maps the Xero 401 reconnect text; we'll widen it to also catch `invalid_grant` from the token endpoint, and the dashboard banner keys off that tag.

### Step 4 — Migrate the plaintext token on next successful refresh
- Already handled by `materializeConnection` backfill — once the user reconnects, the new tokens will be encrypted and the legacy `access_token` / `refresh_token` columns nulled out.

## Out of scope
- No schema changes.
- No changes to individual widget queries beyond reading the new error tag.
- Not touching the OAuth flow itself — it works; we're just routing users to it sooner.

## Technical notes
- Files changed: `src/lib/xero/api.server.ts`, `src/routes/_authenticated/clients.$clientId.index.tsx`, `src/components/dashboard/XeroLoadState.tsx` (extend `friendlyXeroError`).
- No migration needed.
