# Traction Advisory — Security overview

Traction Advisory is a Xero-connected advisor dashboard for accounting practices and the clients they invite. It is designed to meet the Xero API Consumer Security Standard.

## Which document is which, and which one wins

| Document | What it is | Authority |
| --- | --- | --- |
| Project Knowledge — "Security Rules and Change Gate" | The binding rules the agent follows on every change | **Binding. Wins over everything below.** |
| [access-control-spec.md](./access-control-spec.md) | The detail behind those rules, and the facts that caused past incidents | Detail; Project Knowledge wins on conflict |
| [access-matrix.ts](./access-matrix.ts) / [access-matrix.md](./access-matrix.md) | The evidence: every role × table × command expectation, proved on every `bun run security:check` | **Evidence. Where prose and the matrix disagree, the matrix is right.** |
| [access-control.md](./access-control.md) | The assessor-facing summary tying it all together | Summary; never authoritative |

Generated or verified registers: [definer-register.md](./definer-register.md), [admin-client-register.md](./admin-client-register.md), [grant-dump-phase7.md](./grant-dump-phase7.md), [xero-assessment-inputs.md](./xero-assessment-inputs.md), and open work in [../security-backlog.md](../security-backlog.md).

Policies:

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
