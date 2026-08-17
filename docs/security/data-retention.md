# Data retention

| Data | Retention |
| --- | --- |
| Audit log (`audit_log`) | 2 years (exceeds the 1-year Xero minimum). Enforced automatically by the nightly `purge_expired_security_logs()` job (pg_cron, 03:17 UTC); on-demand purge also available in Admin → Security. |
| Sign-in history (`login_events`) | 2 years, purged by the same nightly job. |
| Xero OAuth state (`xero_oauth_states`) | 15 minutes, single-use, deleted on callback. |
| Xero access/refresh tokens | Deleted immediately on disconnect; otherwise retained for the life of the connection. |
| User accounts | Retained until the firm requests deletion or the user is removed. |
| Email send log | 90 days. |
| Rate-limit buckets | 24 hours rolling. |

## Retention configuration

Retention windows live in `public.security_settings` (`audit_retention_days`, `login_retention_days`, both 730 by default). Only platform super admins can read them; only the service role can run the purge function. Each purge writes an `audit_retention_purge` entry recording how many rows were removed, and those entries are never purged.

## Deletion on request

Customer data deletion requests are handled within 30 days by an admin performing the corresponding cascade delete on the firm or user row. The action is recorded in the audit log.

## Backups

Database backups are managed by Lovable Cloud / Supabase. Restoring from a backup will restore deleted data; deletion requests therefore include flagging the customer in case of a restore.
