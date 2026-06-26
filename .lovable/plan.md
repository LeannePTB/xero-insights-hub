# Xero Security Standard — Traction Advisory

Brings this project to the same posture as hub.positivetraction.com.au, matched to the Xero API Consumer Annual Security Assessment.

## 1. Encryption of Xero tokens at rest (Section 2)

- Add a new server secret `TOKEN_ENC_KEY` (32-byte random, generated via `generate_secret`).
- Create `src/lib/crypto.server.ts` with AES-256-GCM `encryptToken()` / `decryptToken()` helpers (random IV per token, auth tag appended).
- Reuse the existing unused `access_token_enc` / `refresh_token_enc` columns on `xero_connections`. Migration to:
  - backfill `*_enc` from the plaintext columns on existing rows,
  - drop the plaintext `access_token` / `refresh_token` columns,
  - rename `*_enc` → `access_token` / `refresh_token` (keep API surface stable) **or** keep `_enc` naming and update code (preferred — clearer in DB).
- Update `src/lib/xero/api.server.ts` and `src/routes/api/public/xero/callback.ts` to encrypt on write and decrypt on read (refresh-token rotation included).
- Revoke any remaining `SELECT` on those columns from `authenticated` and `anon`.

## 2. OAuth 2.0 + PKCE (Section 2.1)

- Update the Xero connect initiation server fn to generate a `code_verifier` (43-128 chars) + S256 `code_challenge`, store the verifier in `xero_oauth_states` (new `code_verifier` column), and add `code_challenge` / `code_challenge_method=S256` to the auth URL.
- Update `src/routes/api/public/xero/callback.ts` to send `code_verifier` on the token exchange.
- Keep state single-use, 15-minute expiry (already in place).

## 3. Mandatory TOTP MFA — AAL2 (Section 3)

- Call `supabase--configure_auth` to enable Email MFA (TOTP) and disable signup is already in place; enable `password_hibp_enabled: true` at the same time.
- New public routes: `/auth/mfa-enroll` (shows QR + verify) and `/auth/mfa-verify` (challenge for users that already enrolled).
- Update `src/routes/_authenticated/route.tsx` to check `aal` from `getUser()` JWT and redirect to enroll/verify until AAL2.
- Add a "Reset MFA" admin action in the Security tab (super-admin only) that lists factors and unenrolls via Auth Admin API.

## 4. Append-only audit log (Section 7)

- Migration: revoke `UPDATE` and `DELETE` on `audit_log` from `authenticated`; keep `INSERT` (already covered by `service_role` writes via server fns) and admin-only `SELECT`.
- Document the 2-year retention; add a `pg_cron` purge job for rows older than 24 months.

## 5. Leaked-password check (Section 3)

- `supabase--configure_auth` with `password_hibp_enabled: true`.

## 6. Admin Security section + downloadable docs

- New route `src/routes/_authenticated/admin.security.tsx` (super-admin gated, tab in existing admin nav) with:
  - Posture summary (TLS, MFA, encryption, RLS, scopes).
  - Live status checks: HIBP enabled, MFA enrollment count, token encryption coverage, last audit-log purge.
  - Reset MFA / disconnect Xero / view audit log links.
  - Download buttons for each policy doc (served as static markdown from `/docs/security/*`).
- New markdown files under `docs/security/`:
  - `README.md`, `access-control.md`, `data-hosting.md`, `data-retention.md`, `incident-response.md`, `monitoring.md`, `sdlc.md`, `vulnerability-management.md`, `xero-assessment-mapping.md`.
  - Content mirrors the Hub docs, retargeted to Traction Advisory (firm/client model, advisor + client_viewer roles, current connectors).

## Technical details

- Token encryption format: `base64(iv ‖ ciphertext ‖ authTag)` — 12-byte IV, 16-byte tag.
- Crypto helpers loaded only via `await import('@/lib/crypto.server')` inside server-fn handlers; never at module scope of `*.functions.ts`.
- MFA gate added in the already-managed `_authenticated/route.tsx`. Because this layout is integration-managed, the gate is added as a child check inside the existing `beforeLoad` (acceptable — it does not duplicate the session check, it extends it).
- Policy docs served via a TanStack server route `/api/public/docs/security/$file` that returns the markdown with `Content-Type: text/markdown` — also lets the customer link to them from the Xero assessment.
- All changes scoped to advisor app only; no client-facing UI changes.

## Out of scope (call out, not building)

- Rotating `XERO_CLIENT_SECRET` (user action in Xero developer portal).
- DR / backup restore testing automation.
- Penetration test scheduling.

Approve and I'll implement in this order: migration + crypto → callback PKCE → MFA enrollment → admin security page + docs → HIBP toggle.
