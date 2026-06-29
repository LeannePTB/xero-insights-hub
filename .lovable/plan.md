## Where we stand vs Xero's certification checkpoints

I re-read Xero's checkpoint list and walked the codebase. Here is the honest status of each one.

### ✅ Done

- **Checkpoint 3 — Connection management.** Setup page lists connected tenant by name, shows status, has branded Connect / Reconnect / Disconnect buttons, calls `DELETE /connections` + token revoke on disconnect, and auto-flags `status = 'disconnected'` on 401 so a Xero-side disconnect surfaces the reconnect banner.
- **Checkpoint 4 — Branding.** `ConnectWithXeroButton` uses Xero blue `#13B5EA`, white X mark, undistorted, min-height, used everywhere the user touches a Xero connection.
- **Checkpoint 6 (partial) — Error handling.** `XeroLoadState` + reconnect banner surface API errors with the Xero-returned reason, plus scope hints.
- **Checkpoints 8 & 9 — Account mapping / Taxes.** Not applicable; the app is read-only and writes nothing back to Xero.

### ⚠️ Partial / needs follow-up

- **Checkpoint 1 — Sign Up with Xero.** Branded button is on `/auth`, but click only fires a "coming soon" toast. The actual identity OAuth flow, `openid profile email` scopes, identity callback, and invite-email matching are not built. **This is the biggest remaining gap and Xero requires it for App Store listing.**
- **Checkpoint 5 — Scopes.** Read-only ✅, `offline_access` ✅, granular scopes ✅. Missing `openid profile email` — required only once we actually wire Sign Up / Sign In with Xero.
- **Checkpoint 6 — Error log surface.** Per-call errors are shown, but there's no per-tenant "integration log" page Xero recommends. Low priority for a read-only dashboard app, but worth noting.
- **Checkpoint 7 — Data integrity.** Reads only, so most sub-points don't apply. Multi-currency is currently passed through as-is; if any client runs a multi-currency Xero file we should confirm widget totals show the org's base currency consistently. Not blocking.

### N/A

- **Checkpoint 2 — App Store tier.** Commercial decision (Plus tier+); nothing to build.

---

## What I propose we tackle next

Pick one of these — I'd recommend **A**:

**A. Finish Checkpoint 1 — Sign Up / Sign In with Xero (recommended)**
   1. Add `openid profile email` to `src/lib/xero/scopes.ts` behind a flag so the existing data connect flow keeps the same scope string.
   2. New server route `src/routes/api/public/xero/identity-callback.ts` that exchanges the code, reads the Xero `id_token` (email + name), and matches by **invited email only** (rejects unknown emails with a clear message — keeps your invite-only access model intact).
   3. New `startXeroSignIn` server fn that mints state + PKCE for the identity flow (separate state row type so we don't confuse it with the data connect flow).
   4. Wire the existing branded button on `/auth` to call it instead of the toast.
   5. After successful identity match, mint a Supabase session for that user (admin `generateLink` magic-link, then redirect through it) and resume normal MFA routing.

**B. Multi-currency safety pass (Checkpoint 7)**
   - Audit `PnlWidget`, `CashflowWidget`, `TaxLiabilityWidget` to confirm we always render in the org's base currency and never sum mixed-currency values silently.

**C. Integration log page (Checkpoint 6 polish)**
   - A simple per-tenant page that lists recent Xero API errors from `audit_log` so users can self-diagnose.

### Out of scope for this plan

- Actual App Store submission, listing copy, pricing tier selection — those are commercial steps you do in Xero's developer portal.
- Any change to the data-connect OAuth flow itself; it's working and certified-shape.

Tell me **A**, **B**, **C**, or a combo, and I'll switch to build mode and implement.
