# Data retention

| Data | Retention |
| --- | --- |
| Audit log (`audit_log`), including client-data read events | 2 years (exceeds the 1-year Xero minimum). Enforced automatically by the nightly `purge_expired_security_logs()` job (pg_cron, 03:17 UTC); on-demand purge also available in Admin → Security. |
| Sign-in history (`login_events`) | 2 years, purged by the same nightly job. |
| Xero API error telemetry (`xero_api_errors`) | 30 days, pruned on write. |
| Xero OAuth state (`xero_oauth_states`) | 15 minutes, single-use, deleted on callback. |
| Xero access/refresh tokens | Revoked at Xero on disconnect and removed (revocation is verified before anything is marked; the same update that marks the row also clears both encrypted token columns). The connection row itself is kept — it is never deleted, because deleting it would cascade away the client-to-Xero-file link — so the file returns to the same client on reconnect, with fresh tokens. A token Xero itself rejects (`grant_revoked`) and an unassigned-connection cleanup are cleared the same way. The one exception is the nightly authorisation reconcile (`not_authorised`): that token is still valid for the other Xero files on the same consent and the file can come back without re-authorising, so its ciphertext stays. |
| User accounts | Retained until the organisation requests deletion or the person is removed. |
| Email send log | 90 days. |
| Rate-limit buckets | 24 hours rolling. |

## Retention configuration

Retention windows live in `public.security_settings` (`audit_retention_days`, `login_retention_days`, both **730 live, verified 12 September 2026**). Only platform super admins can read them, at aal2; only the service role can run the purge function. Each purge writes an `audit_retention_purge` entry recording how many rows were removed, and those entries are never purged.

Read-audit volume: reads of a client's figures are grouped per person, client, Xero file, read key and source in five-minute windows, which is what keeps a two-year window practical.

## Deletion on request

Customer data deletion requests are handled within 30 days by an admin performing the corresponding cascade delete on the firm or user row. The action is recorded in the audit log.

## Backups

Database backups are managed by Lovable Cloud / Supabase. Restoring from a backup will restore deleted data; deletion requests therefore include flagging the customer in case of a restore.
