# Pre-lodgement security fix (invite-only confirmed)

Ran the security scanner against the Xero API Consumer Security Standard controls. Everything documented in `docs/security/` is in place: OAuth 2.0 + PKCE (S256), AES-256-GCM token wrap with server-only `TOKEN_ENC_KEY`, TLS 1.2+ / HSTS, mandatory TOTP MFA (AAL2 gate), HIBP leaked-password check, RLS + explicit GRANTs on every public table, append-only `audit_log` with 2-year retention, least-privilege Xero scopes (`.read` + `offline_access` only).

Signup remains **invite-only**: `disable_signup: true` stays as-is; new users only enter via admin-issued `access_invites` tokens (14-day expiry, SHA-256 hashed, single-use).

## Finding to fix

The scanner flagged 4 warnings — all one root cause. Two `SECURITY DEFINER` functions in `public` are executable by `anon` and `authenticated`:

- `public.email_queue_wake()` — trigger function, never called directly.
- `public.email_queue_dispatch()` — invoked by `pg_cron` (runs as `postgres`), never called from the Data API.

Because they are `SECURITY DEFINER`, any signed-in (or anonymous) caller hitting them via PostgREST would execute with elevated privileges. Maps to Xero assessment Section 3 (least privilege) and Section 5 (server config hardening).

All other `SECURITY DEFINER` functions (`me_is_super_admin`, `check_rate_limit`, `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`, `get_mfa_posture_counts`, `handle_new_user`, `audit_user_roles_change`, `enforce_unreconciled_line_viewer_columns`) are already restricted to `postgres` / `service_role`.

## Change

Single migration:

```sql
REVOKE EXECUTE ON FUNCTION public.email_queue_wake()     FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, PUBLIC;
```

`postgres` and `service_role` keep EXECUTE, so the enqueue trigger and the `pg_cron` job continue working unchanged.

## Verification

- Re-run the security scanner — the 4 warnings clear.
- Send a test invite email; confirm it lands (trigger + cron path still fires).
- No app-code changes; no client or server function calls these directly.

## Not changing

- Signup stays disabled (invite-only).
- No changes to `docs/security/*` — the controls described there are unaffected; this only tightens grants to match what's already documented as least privilege.
