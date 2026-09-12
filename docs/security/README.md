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

Policies and registers:

- [Access review](./access-review.md)
- [Backup, restore and recovery objectives](./backup-and-restore.md)
- [Data hosting & third parties](./data-hosting.md)
- [Data residency — decision record](./data-residency-decision.md)
- [Data retention](./data-retention.md)
- [Incident register, drills and security contact](./incident-register.md)
- [Incident response](./incident-response.md)
- [Key and secret rotation](./key-and-secret-rotation.md)
- [Security monitoring](./monitoring.md)
- [Secure SDLC](./sdlc.md)
- [Vulnerability management](./vulnerability-management.md)
- [Vulnerability management — records and SLA](./vulnerability-records.md)
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
| RBAC | Roles stored in a dedicated `user_roles` table, checked via the `has_role(uuid, app_role)` security-definer function. `super_admin` alone grants no access to any organisation or client data; there are exactly three access paths (membership, a read-only 72-hour support grant approved by that organisation's owner, and metadata-only platform operations). |
| One rulebook | Access decisions live in the database as caller-scoped functions and RLS policies; server code calls them and never re-implements them. `bun run security:check` proves a 1,287-row access matrix against a copy of the live schema, policies, grants and triggers, and static guards fail the build on a re-implementation, an unauthorised service-role call or a `profiles.email` read. |
| Row-level security | RLS enabled on all 53 `public` tables. Policies are per command and scope reads to organisation members, an active support grant, or `auth.uid()`. `authenticated` holds only the privileges those policies admit; `anon` holds none. |
| MFA | TOTP MFA is mandatory and **enforced on the server**: `requireAal2` on every authenticated server function (two rate-limited sign-in logging exceptions), a RESTRICTIVE `mfa_aal2_required` policy on 51 of 53 tables, and an aal2 assertion in every signed-in-callable SECURITY DEFINER function. The browser gate is UX only. |
| Password policy | Leaked-password (HIBP) check enabled. Self-signup is disabled — admins invite users. |
| Audit logging | Append-only `audit_log` (`UPDATE`/`DELETE` revoked from app roles) records sign-ins, invites, membership/role/ownership changes, support grants, comps, administrative actions, Xero connect/disconnect/refusal — and **every read of a client's financial figures** (`xero_data_read`, `client_report_read`), grouped per person and client in five-minute windows and never holding a figure, a name, a token, an IP or a device. Only practice super admins may read it. |
| Retention | `audit_log` and sign-in history retained for 2 years (`security_settings`, 730 days — exceeds the Xero 1-year minimum), purged nightly. OAuth state rows purged after 15 minutes. On disconnect the Xero grant is revoked at Xero first (fail closed), then the connection row is marked `disconnected` and kept, together with the client-to-file link, so a reconnect restores the same file to the same client. The same update removes both encrypted token columns, so a revoked token is never left at rest (backlog 38, closed). |
| Secret management | Lovable Cloud secrets. Service-role key never imported at module scope of client-reachable files. |
