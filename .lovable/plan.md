## Pre-lodgement security recheck — clean

Ran the full security scan (Supabase RLS/GRANTs, connector scan, supply-chain, Lovable Supabase scanner). **Zero findings across all scanners.**

### Controls verified against the Xero API Consumer Security Standard

| Xero section | Control | Status |
| --- | --- | --- |
| §2 Encryption | OAuth 2.0 + PKCE (S256); Xero tokens AES-256-GCM wrapped with `TOKEN_ENC_KEY`; TLS 1.2+ / HSTS; no tokens in URLs/HTML; plaintext token columns dropped | Pass |
| §3 Authentication | Mandatory TOTP MFA, AAL2 gate on `_authenticated` shell; HIBP leaked-password check; invite-only signup (`disable_signup: true`); per-firm connection ownership | Pass |
| §4 Data hosting | Cloudflare (AU edge) + Supabase managed Postgres (AU); documented sub-processors | Pass |
| §5 App server config | RLS enabled on every public table with explicit GRANTs; `SECURITY DEFINER` funcs least-privileged (`email_queue_wake`/`dispatch` EXECUTE revoked from anon/authenticated); service-role key never in client graph; strict security headers | Pass |
| §6 Vulnerability mgmt | Supply-chain scan clean; scanner runs on every change; schema linter after every migration | Pass |
| §7 Logging | Append-only `audit_log` (UPDATE/DELETE revoked from app roles); 2-year retention | Pass |
| §8 Monitoring / IR | Cloudflare WAF, rate-limit buckets, `login_events`; incident response documented in `docs/security/` | Pass |

Also confirmed the privilege-escalation fix from the previous pass is still in place: `user_roles` writes are super-admin only; advisors read-only.

### Recommendation

**Safe to lodge.** No code or migration changes required this pass.

No files to change — this plan is a verification-only report. Approve to close out the recheck.