# Access control

## Authentication

- Self-signup is disabled.
- Email/password sign-in plus Google OAuth.
- TOTP MFA is mandatory for every authenticated user. The `_authenticated` layout redirects to the in-app MFA enrolment / verification screen until the session reaches AAL2.

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
