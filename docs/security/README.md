# Traction Advisory — Security overview

Traction Advisory is a Xero-connected advisor dashboard for accounting firms and the clients they invite. It is designed to meet the Xero API Consumer Security Standard.

Detailed policies live in this folder:

- [Access control](./access-control.md)
- [Data hosting & third parties](./data-hosting.md)
- [Data retention](./data-retention.md)
- [Incident response](./incident-response.md)
- [Security monitoring](./monitoring.md)
- [Secure SDLC](./sdlc.md)
- [Vulnerability management](./vulnerability-management.md)
- [Xero assessment mapping](./xero-assessment-mapping.md)

## Technical controls in place

| Control | How |
| --- | --- |
| TLS in transit | Hosted on Lovable Cloud / Cloudflare; all endpoints HTTPS with TLS 1.2+, AES-256, SHA-256. HSTS preload header is set on every response. |
| OAuth 2.0 + PKCE | Xero connect requests use authorization-code-with-PKCE (S256). State rows are single-use and expire after 15 minutes. |
| No tokens in URLs | OAuth access/refresh tokens are never placed in URL parameters or rendered into HTML. Authorisation codes appear only on the callback URL once and are exchanged server-side immediately. |
| Tokens encrypted at rest | Xero access/refresh tokens are wrapped with application-level AES-256-GCM using a server-only key (`TOKEN_ENC_KEY`), on top of Supabase-managed disk-level encryption. The key lives in Lovable Cloud secrets — never in the database or client bundle. |
| Encryption at rest (general) | Database and object storage use Supabase-managed disk-level encryption (AES-256). Token columns add the application-level wrap above. |
| Least-privilege scopes | Xero requests only `.read` scopes plus `offline_access`. Non-read scopes are blocked at boot. |
| RBAC | Roles stored in a dedicated `user_roles` table, checked via the `has_role(uuid, app_role)` security-definer function. Admin server functions assert `super_admin`. |
| Row-level security | RLS enabled on every table holding client or credential data. Policies scope reads to admins, firm members, or `auth.uid()`. |
| MFA | TOTP MFA enforced for every authenticated user. The `_authenticated` shell requires AAL2 before any page renders. |
| Password policy | Leaked-password (HIBP) check enabled. Self-signup is disabled — admins invite users. |
| Audit logging | `audit_log` table records connect, disconnect, sync, token refresh, role grants and admin actions. `UPDATE`/`DELETE` revoked from app roles — append-only. |
| Retention | `audit_log` retained for 2 years (exceeds the Xero 1-year minimum). OAuth state rows purged after 15 minutes. Tokens deleted on disconnect. |
| Secret management | Lovable Cloud secrets. Service-role key never imported at module scope of client-reachable files. |
