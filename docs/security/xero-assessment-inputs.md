# Xero assessment — inputs and evidence gaps

> **What this file is for.** A working list of what a Xero API Consumer assessor is likely to ask,
> where the answer comes from in this project, and **whether we can evidence it today**. It is NOT
> the assessment response, and it answers nothing. `xero-assessment-mapping.md` holds the mapping to
> the questionnaire sections; this file is the honest state of the evidence behind it.
>
> Compiled 12 September 2026 (Phase 7 batch 3) from the live system, the generated registers and
> `bun run security:check`. "Evidenced" means an assessor could be shown a file, a database object,
> a generated register or a check result in this project. It does not mean an independent third
> party has verified it.

Legend: **Yes** = artefact exists in this project. **Partial** = artefact exists but is incomplete or
unverified in the way an assessor would want. **No** = no artefact; would have to be created.

## 1. Multi-factor authentication

| Likely question | Where the answer comes from | Can we evidence it? |
| --- | --- | --- |
| Is MFA required for everyone with access to Xero data? | `src/lib/auth/require-aal2.ts`; the `mfa_aal2_required` RESTRICTIVE policy on 51 of 53 `public` tables; `app_private.assert_aal2()` in every signed-in-callable definer function (`definer-register.md`) | **Yes** |
| Is it enforced server-side, not just in the UI? | Same three layers; `MfaGate` is documented as UX only in `access-control.md` §Authentication | **Yes** |
| Which paths bypass MFA and why? | Two aal1 logging exceptions (`logAuthEvent`, `logLogin`) and seven deliberately unauthenticated functions, each listed in `access-control-spec.md` §0a with its own credential | **Yes** |
| Do all current administrators have a verified factor? | `auth.mfa_factors`; the `mfa` check in `public.security_posture()` and the Security card | **Partial** — one super admin has no verified TOTP factor. Owner decision: left as is; she is forced to enrol at next sign-in and server enforcement already denies her all data. The posture card correctly shows one Action item until then. |
| Is leaked-password protection switched on? | The auth provider setting is **not readable by the application**, so there is no machine reading. Evidenced instead by an in-product attestation: `public.security_attestations` + `public.record_security_attestation` (aal2 + super admin, actor and time stamped by the server, `audit_log` action `security_attestation_recorded`); shown on the Security card naming who confirmed it and when; mechanism described in `access-control-spec.md` §17 | **Partial** — attested in-product, with who and when. A recorded human confirmation, not an automated check. |
| Can you demonstrate an aal1 session being denied? | `tests/` aal1-denied meta-test in the PGlite suite; matrix rows marked `live` | **Partial** — proved against the schema copy. The live smoke suite that would prove it end-to-end with real sessions is approved but not built (parked until after Phase 7). |

## 2. Access control and the three paths

| Likely question | Where the answer comes from | Can we evidence it? |
| --- | --- | --- |
| How is customer data segregated between tenants? | RLS on all 53 tables; `app_private.has_firm_access`, `user_can_read_client`, `user_can_access_tenant`; `access-control-spec.md` §3, §6 | **Yes** |
| How do you prove least privilege rather than assert it? | `access-matrix.ts` (1,287 rows) proved by `bun run security:check` against a PGlite copy of the live schema, policies, grants, definer bodies and triggers, with a catalogue fingerprint | **Yes** |
| Do staff have standing access to all customers? | No: three paths only — membership, a read-only support grant, metadata-only platform operations. `super_admin` alone grants no organisation or client data (`access-control-spec.md` §3, §4a) | **Yes** |
| Can a caller substitute another tenant's identifier? | `tenant_id` is resolved server-side (`client_for_tenant`, `assert_tenant_belongs_to_client`); static guard fails the build on a request-sourced identifier used as a grant | **Yes** |
| Who approves access, and is it reviewed? | Support grants are approved by that organisation's owner, max 72h, never self-approved (`firm_support_access`) | **Partial** — the mechanism is evidenced; there is no periodic access-review record. |
| How do you prevent the rules drifting back into application code? | `access-control-spec.md` §6a; `tests/static-guards.test.ts`; `converted-files.ts`; `admin-client-register.md` | **Yes** |

## 3. Support access to a customer's data

| Likely question | Where the answer comes from | Can we evidence it? |
| --- | --- | --- |
| Can support staff read customer accounting data, and with whose consent? | `firm_support_access`: owner-approved, one named person, expiry capped at 72h by a CHECK constraint | **Yes** |
| Is support access read-only? | Write policies use `has_firm_access`/`user_can_write_client` and never `platform_staff_can_access_firm`; matrix rows deny every support write, branding included | **Yes** |
| Is support access logged? | `audit_log` grant/approve/revoke events; `public.firm_support_access_audit` | **Yes** |
| Is what support staff actually looked at recorded? | Read audit (§4 below) records the access path alongside the read | **Yes** |

## 4. Audit logging, monitoring and retention

| Likely question | Where the answer comes from | Can we evidence it? |
| --- | --- | --- |
| What is logged? | `audit_log`: sign-ins, invites, membership/role/ownership, support grants, comps, administrative writes, Xero connect/disconnect/refusal, and every read of client figures (`xero_data_read`, `client_report_read`) | **Yes** |
| Are logs append-only and tamper-evident? | `UPDATE`/`DELETE` revoked from app roles; purge only via the service-role function, which writes its own `audit_retention_purge` row | **Partial** — append-only for app roles is evidenced. There is no off-box or write-once copy, so a database superuser is outside the model. |
| Who can read the log? | Practice super admins at aal2 only. **An organisation may not read its own audit log** — settled owner decision with reasoning in `access-control-spec.md` §9 | **Yes** |
| Retention period? | `security_settings.audit_retention_days` = 730 (verified live); nightly pg_cron purge at 03:17 | **Yes** |
| Do you monitor for suspicious access? | `monitoring.md`; `public.security_posture()` and `public.read_audit_posture()` on the Security card | **Partial** — posture checks and the trail exist; there is no alerting on anomalous access, and no evidence of anyone reviewing the trail on a schedule. |
| Can you produce a lookback for a specific customer or period? | Audit export in Admin → Security, split into security events and client-data reads | **Partial** — the export exists; no worked example has been produced and retained. |

## 5. Token storage and encryption

| Likely question | Where the answer comes from | Can we evidence it? |
| --- | --- | --- |
| How are Xero refresh tokens stored? | `xero_connections.access_token_enc` / `refresh_token_enc` (`bytea`), AES-256-GCM in `src/lib/crypto.server.ts` | **Yes** |
| Where does the key live? | `TOKEN_ENC_KEY` in Lovable Cloud secrets, read server-side only; never in the database or a client bundle. `token_enc_key` check in `security_posture()` | **Yes** |
| Can the browser reach a token? | No grant on the token columns for any app role (`grant-dump-phase7.md`); `authenticated` has SELECT on 13 non-token columns; never `select *` | **Yes** |
| Key rotation? | — | **No** — no rotation procedure or re-wrap script exists. Would need to be written. |
| Are tokens ever in URLs or logs? | OAuth uses PKCE (S256); state rows single-use, 15 minutes; audit and telemetry rows exclude tokens, headers and payloads by rule and by static guard | **Yes** |

## 6. Disconnection and revocation

| Likely question | Where the answer comes from | Can we evidence it? |
| --- | --- | --- |
| Does disconnecting revoke at Xero? | `src/lib/xero/connections.functions.ts`: `DELETE /connections/{connectionId}` first, then verify it is gone, then mark. Fails closed if Xero does not confirm | **Yes** — exercised live on the practice's own Xero file on 12 September 2026 (`xero_disconnected` then `xero_reconnected` in `audit_log`). |
| What happens to the stored tokens and data? | The row is marked `disconnected` and kept (deleting it would cascade away the client-to-Xero-file link); the revoked ciphertext remains until the next authorisation overwrites it — backlog 38; client history and snapshots are retained deliberately (owner decision) | **Partial** — behaviour is evidenced and deliberate, but "tokens deleted on disconnect" is **not** what happens, and the backlog item is open. |
| Is disconnection logged? | `xero_disconnected` on success, and the failure path, both audited | **Yes** |
| Can a connection exist without an owning organisation? | No: `xero_connections.firm_id` is `NOT NULL`; a tenant that cannot be placed, or that exceeds the plan, is refused and not stored (`xero_file_refused`) | **Yes** |
| Only requested scopes? | `.read` scopes plus `offline_access`; non-read scopes blocked at boot; `xero_required_scopes()` / `xero_missing_scopes` | **Yes** |

## 7. Secrets handling

| Likely question | Where the answer comes from | Can we evidence it? |
| --- | --- | --- |
| Where are secrets held? | Lovable Cloud project secrets; read inside server handlers only | **Yes** |
| Is the service-role key reachable from the browser? | Import protection on `*.server.ts` / admin client; `admin-client-register.md` lists every use with a verified reason | **Yes** |
| Secret rotation and access list? | — | **No** — no rotation schedule and no record of who can read the secrets. |
| Are secrets in source control? | `.env` holds only the publishable keys | **Yes** |

## 8. Incident response

| Likely question | Where the answer comes from | Can we evidence it? |
| --- | --- | --- |
| Do you have a documented incident response plan? | `incident-response.md` — definitions, containment/assessment/notification steps, owners and timelines including the Xero 72-hour notification | **Yes (document only)** |
| Has it been tested? | — | **No** — no tabletop exercise, no drill record. |
| Have you had an incident, and is there a record? | — | **No** — no incident register exists (nothing to record yet, but the register itself is missing). |
| Named security contact and reporting channel? | `incident-response.md` (practice principal, 2 business days to acknowledge) | **Partial** — named in the document; no published security contact or disclosure address. |

## 9. Dependency and vulnerability management

| Likely question | Where the answer comes from | Can we evidence it? |
| --- | --- | --- |
| Do you have a vulnerability management policy? | `vulnerability-management.md` (OWASP Top 10 baseline, quarterly dependency review, linter after each migration) | **Yes (document only)** |
| Can you show scan results and remediation SLAs? | — | **No** — no retained scan output, no patch SLA, no record of a dependency finding being fixed. |
| Penetration test? | — | **No** — never performed. |
| Secure development lifecycle? | `sdlc.md`; the Security Gate in Project Knowledge; `bun run security:check` on every change | **Partial** — the gate and the automated checks are strong evidence; there is no code-review record because the practice has a single developer. |
| Static analysis / build-time security checks? | `tests/static-guards.test.ts`, matrix proof, definer register check, fingerprint check | **Yes** |

## 10. Data residency and hosting

| Likely question | Where the answer comes from | Can we evidence it? |
| --- | --- | --- |
| Where is customer data stored? | `data-hosting.md` — Supabase managed Postgres in an Australian region, Lovable Cloud on Cloudflare Workers (Sydney edge), no object storage enabled | **Partial** — the region is documented and no alternate region is offered; there is no platform attestation retained to back the claim. |
| Encryption at rest and in transit? | Supabase-managed AES-256 at rest plus the application-level token wrap; TLS 1.2+ with HSTS (`tls_hsts` posture check) | **Yes** |
| Backups and restore? | `data-retention.md` — managed by the platform | **Partial** — no tested restore, no documented RPO/RTO. |

## 11. Sub-processors and third parties

| Likely question | Where the answer comes from | Can we evidence it? |
| --- | --- | --- |
| Who are your sub-processors? | `data-hosting.md` sub-processor table: Cloudflare (TLS/edge), Supabase (Postgres, auth, storage), Xero (source data), Resend via Lovable (email), Stripe (payments — added this turn, it was missing) | **Yes** |
| Do they have access to customer accounting data? | Hosting processes it as infrastructure; email carries addresses and message bodies; Stripe receives billing data only, never Xero figures (`data-hosting.md`) | **Yes** |
| Customer-facing privacy terms and DPA? | — | **No** — outside this repository; would need to be supplied by the practice. |

## Summary of gaps to close before the assessment

Nothing here changes access control; these are artefacts to write or produce.

1. Key rotation procedure for `TOKEN_ENC_KEY` (and a re-wrap path). **No artefact.**
2. Secret rotation schedule and the list of who can read project secrets. **No artefact.**
3. Incident response drill and an incident register. **No artefact.**
4. Retained vulnerability/dependency scan output with a remediation SLA. **No artefact.**
5. Retained platform attestations (SOC 2 / ISO) for Supabase and Cloudflare to back the residency and hosting claims. **No artefact.**
6. Confirmed hosting region, and a tested restore with RPO/RTO. **Partial.**
7. Published security contact / disclosure channel. **Partial.**
8. Periodic access review record (memberships, support grants, roles). **Partial.**
9. Backlog 38 — clear revoked token ciphertext at disconnect, so "revoked and removed" is literally true.
10. The slim live smoke suite (approved, after Phase 7), which is what turns "proved against a copy of the schema" into "proved against the running system with real sessions".
