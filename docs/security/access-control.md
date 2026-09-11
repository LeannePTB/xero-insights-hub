# Access control

## Authentication

- Self-signup is disabled.
- Email/password sign-in plus Google OAuth.
- TOTP MFA is mandatory for every authenticated user, and enforced on the server (11 September 2026). The browser gate is UX only.
  - **Server functions.** `requireAal2` (`src/lib/auth/require-aal2.ts`) wraps the generated `requireSupabaseAuth` and rejects any session whose token claim `aal` is not `aal2`. It is used by 211 of the 213 authenticated server functions. The two exceptions are `logAuthEvent` and `logLogin`, which record the sign-in and MFA lifecycle itself, before a second factor can exist. Both are write-only, take their actor and email from the verified token, accept no caller free text (`logAuthEvent` validates its action against a six-value allow-list, `logLogin` takes no input), and are rate limited per user through `public.check_rate_limit` (30 and 20 calls per 5 minutes).
  - **Database.** `app_private.is_aal2()` reads the `aal` claim from the request JWT. A RESTRICTIVE `FOR ALL TO authenticated` policy named `mfa_aal2_required` sits on **every `public` table `authenticated` holds any privilege on** — 49 tables — with only two exclusions, both owner-approved: `plan_levels` and `tier_settings`, the plan and tier catalogue, which hold no organisation, client or personal data. `app_private.assert_aal2()` guards 25 `public` SECURITY DEFINER functions executable by `authenticated`, and `public.xero_missing_scopes` returns `null` unless `app_private.is_aal2()`. Only `public.xero_required_scopes` is unguarded: it returns a fixed constant list and reads no table. `app_private` is not an exposed PostgREST schema (a request with `Accept-Profile: app_private` returns `PGRST106: Only the following schemas are exposed: public, graphql_public`).
  - **System contexts.** Requests with no JWT claims (cron, migrations) and `service_role` requests (Xero OAuth callback, Stripe webhook, nightly snapshot refresh, email queue) are treated as system contexts, which already bypass RLS entirely.
  - The `_authenticated` layout still redirects to the in-app MFA enrolment / verification screen until the session reaches AAL2.

## Authorisation

- Roles stored in `public.user_roles` and checked through the `has_role(uuid, app_role)` and `me_is_super_admin()` security-definer functions.
- Roles: `super_admin`, `advisor`, `client_viewer`.
- All Xero server functions, admin server functions, and the Security console assert role membership before performing any read or write.
- Row-level security is enabled on every table holding client or credential data; policies scope reads to firm members or `auth.uid()`.

## Connection ownership

Xero connections are owned by a firm and a user. Only firm owners and super admins can create, refresh, or delete them. Disconnecting permanently removes the stored encrypted tokens.

## Account lifecycle

- Invites are emailed by an admin; the token hash is single-use.
- Password resets go through Supabase Auth with HIBP enforcement.
- Super admins can reset a user's MFA factors from the Admin → Security console; the action is recorded in the audit log.
