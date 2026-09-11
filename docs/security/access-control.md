# Access control

## Authentication

- Self-signup is disabled.
- Email/password sign-in plus Google OAuth.
- TOTP MFA is mandatory for every authenticated user, and enforced on the server (11 September 2026). The browser gate is UX only.
  - **Server functions.** `requireAal2` (`src/lib/auth/require-aal2.ts`) wraps the generated `requireSupabaseAuth` and rejects any session whose token claim `aal` is not `aal2`. It is used by 211 of the 213 authenticated server functions. The two exceptions are `logAuthEvent` and `logLogin`, which record the sign-in and MFA lifecycle itself, before a second factor can exist; both are write-only and return no data.
  - **Database.** `app_private.is_aal2()` reads the `aal` claim from the request JWT. A RESTRICTIVE `FOR ALL TO authenticated` policy named `mfa_aal2_required` sits on all 40 tables holding organisation, client, Xero, audit or personal data, and `app_private.assert_aal2()` is the first statement of every `public` SECURITY DEFINER function executable by `authenticated` (25 functions). `xero_required_scopes` and `xero_missing_scopes` are excluded — they return the fixed Xero scope list, no tenant data. Tier/plan configuration tables (`plan_levels`, `tier_settings`, `tier_widget_config`) and service-role-only tables (`xero_oauth_states`, `rate_limit_buckets`, `email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens`, `security_settings`, `security_contact_details`) are excluded.
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
