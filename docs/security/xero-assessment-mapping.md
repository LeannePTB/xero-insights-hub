# Xero API Consumer assessment — mapping

This document maps each section of the Xero API Consumer Annual Security Assessment to the controls we operate in Traction Advisory.

## Section 2 — Encryption

| # | Question | Answer | Evidence |
| --- | --- | --- | --- |
| 2.1 | OAuth 2.0, no token exposure | Yes — OAuth 2.0 with PKCE (S256) for Xero; tokens never sent to client | `src/lib/xero/connections.functions.ts`, `src/routes/api/public/xero/callback.ts` |
| 2.2 | Encrypt refresh tokens at rest | Yes | `xero_connections.refresh_token_enc` (`bytea`) |
| 2.3 | Symmetric encryption, 128-bit+ key | Yes — AES-256-GCM | `src/lib/crypto.server.ts` |
| 2.4 | Encryption key in KMS / secret store | Yes — Lovable Cloud secret `TOKEN_ENC_KEY` | `sdlc.md` |
| 2.5 | TLS 1.2+, AES-256, SHA-256 in transit | Yes — Cloudflare TLS termination | `README.md` |
| 2.6 | App server uses TLS 1.2+ | Yes | Cloudflare config |
| 2.7 | No tokens / sensitive data in URLs or HTML | Yes | `README.md` |
| 2.8 | Encryption at rest for sensitive data | Yes | `README.md` |
| 2.9 | Enforce encryption at rest | Yes | Migration `*_enc` columns |
| 2.10 | Which methods | Application-level AES-256-GCM for tokens on top of Supabase disk encryption | `README.md` |

## Section 3 — Authentication

| # | Question | Answer | Evidence |
| --- | --- | --- | --- |
| 3.1 | Strong customer authentication | Yes — TOTP MFA mandatory, AAL2 required for app shell | `access-control.md` |
| 3.2 | Password policy | HIBP leaked-password check enabled; self-signup disabled | Supabase Auth config |
| 3.3 | Connection ownership | Per-firm, revocable, audit-logged | `access-control.md` |

## Section 4 — Data hosting & third-party access

See [data-hosting.md](./data-hosting.md).

## Section 5 — Application server configuration

See [sdlc.md](./sdlc.md).

## Section 6 — Vulnerability management

See [vulnerability-management.md](./vulnerability-management.md).

## Section 7 — Security logging

| # | Question | Answer | Evidence |
| --- | --- | --- | --- |
| 7.1 | Audit logging implemented & maintained | Yes — `audit_log` table | `README.md` |
| 7.2 | Append-only logs | Yes — `UPDATE`/`DELETE` revoked from app roles | Migration |
| 7.3 | Retention | 2 years (exceeds 1-year Xero minimum) | `data-retention.md` |

## Section 8 — Security monitoring & incident lookback

See [monitoring.md](./monitoring.md) and [incident-response.md](./incident-response.md).
