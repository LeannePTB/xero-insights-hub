# Xero App Store certification — closing the gaps

**Security classification: SECURITY-RELEVANT.** This touches auth, Xero OAuth, tokens, a new public route, and email. Invariants 2 (server-side aal2), 4 (caller-supplied IDs are filters), 7 (supabaseAdmin system contexts only, registered), and 8 (tokens never leave the server) apply throughout. Read `docs/security/access-control-spec.md` before each piece; every piece ends with the full Security Gate (security:check, linter, security report, backlog update).

## What is already compliant (no work)

- Connection management: tenant name + status displayed, Connect/Reconnect/Disconnect buttons, DELETE via the Connections endpoint with post-disconnect verification, Xero-side disconnects detected (401/403 → marked disconnected, reconnect prompt), token rotation stored atomically.
- Scopes: minimal read-only set + `offline_access`, single source of truth in `public.xero_required_scopes()`, write scopes impossible by construction.
- Data integrity: read-only app, ACTIVE accounts, non-archived contacts.
- Checkpoints 7 (account mapping) and 8 (taxes): not applicable — the app never writes to Xero.

## Work item 1 — Sign Up with Xero (required for listing)

Use the **modified flow** (Option B): the app has its own auth with mandatory MFA, so Xero becomes a one-time identity provider that pre-fills sign-up; the full tenant connection happens later in onboarding.

1. New public route `/xero-signup` (the "connect request url" for the App Store listing). Justified public route: no credential of its own — it only starts a Xero OAuth redirect with OpenID scopes (`openid profile email`) plus a signed, expiring state parameter.
2. New OAuth callback (server route) that exchanges the code, reads the identity (name, email, Xero user id), and redirects to the existing sign-up page with the form pre-filled. No tokens stored, no tenant scopes requested at this point.
3. Existing-account handling: if the email already has an account, ask them to sign in normally and link later (no automatic account merging).
4. Sign-up completion continues through the existing flow, including MFA enrolment — unchanged.
5. Add a "Sign in with Xero" button to the login page (recommended by Xero, and expected alongside Sign Up): Xero as identity provider matched to the existing account by verified email; MFA still required after it, so aal2 invariants hold.

## Work item 2 — User-visible Xero error surface

Clients currently see only "reconnect required"; the reason sits in `xero_api_errors` (super-admin telemetry only — that stays).

1. A per-client "Xero sync status" section on the client settings page: last successful refresh, last failure time, and a plain-English reason derived server-side from the stored error category (never raw API bodies, never tokens).
2. Read path goes through a new caller-scoped, aal2-guarded database function returning only that client's sanitised status — no direct table read, no new access path.
3. The overview "data" feed events link to this section.

## Work item 3 — Connection cleanup routine

1. A scheduled job (system context, registered in `docs/security/admin-client-register.md`) that lists Xero connections via the client-credentials grant (`app.connections` scope) and flags tenants with no active client link or whose organisation off-boarded / trial expired past the grace period.
2. Flagged connections are detached via the existing verified `detachTenantFromXero` path (DELETE connection, never token revocation — revocation would detach every organisation on the same Xero account). Each detach is audit-logged.
3. Dry-run first: the first run reports what it *would* detach for your review before any live detaching is enabled.

## Work item 4 — Portal/branding checklist (you do these in Xero's developer portal; I cannot)

- App name must not contain "Xero" and must match the go-to-market name (Traction Advisory).
- Set "Login URL for launcher" to the app's login page (App Launcher checkpoint).
- Use Xero's official Connect/Disconnect button artwork on the connection page.
- After certification, email api@xero.com before any major scope/use-case change.

## Order and verification

1. Work item 2 (smallest, no new auth surface) → 2. Work item 3 (dry run) → 3. Work item 1 (largest).
2. Each item: `bun run security:check` (123 tests, 18 live checks — must stay green), Supabase linter, security report, backlog update.
3. End-to-end check of the sign-up flow in the preview before you submit to Xero.

## Not in scope

- The debtor-ageing defect and key-figures retention decisions still await your call (unchanged).
- Xero App Store subscription/billing API (only needed if you want Xero to handle billing — you use Stripe).
