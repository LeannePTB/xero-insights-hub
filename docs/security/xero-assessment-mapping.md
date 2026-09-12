# Xero API Consumer assessment — mapping

This document maps each section of the Xero API Consumer Annual Security Assessment to the controls we operate in Traction Advisory. It records the mapping only — the honest state of the evidence behind each answer, including the gaps, is in [xero-assessment-inputs.md](./xero-assessment-inputs.md). Where this mapping and `access-matrix.md` disagree, the matrix is right.

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
| 3.1 | Strong customer authentication | Yes — TOTP MFA mandatory and enforced **on the server**: `requireAal2` on authenticated server functions, a RESTRICTIVE `mfa_aal2_required` policy on 51 of 53 tables, and an aal2 assertion in every signed-in-callable definer function. The browser gate is UX only | `access-control-spec.md` §0a, `src/lib/auth/require-aal2.ts`, `definer-register.md` |
| 3.2 | Password policy | HIBP leaked-password check enabled; self-signup disabled | Supabase Auth config |
| 3.3 | Connection ownership | Per organisation (`xero_connections.firm_id` is `NOT NULL`), revocable, audit-logged. Disconnect revokes at Xero first and fails closed; the row is marked, not deleted, keeping the client-to-file link | `access-control-spec.md` §10, `src/lib/xero/connections.functions.ts` |
| 3.4 | Access control model | Three paths only — membership, read-only 72-hour owner-approved support grant, metadata-only platform operations. `super_admin` alone grants no organisation or client data | `access-control-spec.md` §3, §4a; `access-matrix.md` |

## Section 4 — Data hosting & third-party access

See [data-hosting.md](./data-hosting.md).

## Section 5 — Application server configuration

See [sdlc.md](./sdlc.md).

## Section 6 — Vulnerability management

See [vulnerability-management.md](./vulnerability-management.md).

## Section 7 — Security logging

| # | Question | Answer | Evidence |
| --- | --- | --- | --- |
| 7.1 | Audit logging implemented & maintained | Yes — `audit_log`, including **every read of a client's financial figures** (`xero_data_read`, `client_report_read`; sources live/snapshot/cache/report/report_link) with no figures, names, tokens, IPs or devices, grouped per person and client in five-minute windows | `access-control-spec.md` §9a, `src/lib/audit.server.ts`, `public.read_audit_posture()` |
| 7.1a | Who may read the log | Practice super admins at aal2 only. An organisation may not read its own audit log — a deliberate decision, with reasoning | `access-control-spec.md` §9 |
| 7.2 | Append-only logs | Yes — `UPDATE`/`DELETE` revoked from app roles | Migration |
| 7.3 | Retention | 2 years — `security_settings.audit_retention_days` = 730 (verified live), nightly pg_cron purge | `data-retention.md` |

## Section 8 — Security monitoring & incident lookback

See [monitoring.md](./monitoring.md) and [incident-response.md](./incident-response.md).
