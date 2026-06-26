# Data retention

| Data | Retention |
| --- | --- |
| Audit log (`audit_log`) | 2 years (exceeds the 1-year Xero minimum). Purge runs from the Admin → Security console. |
| Xero OAuth state (`xero_oauth_states`) | 15 minutes, single-use, deleted on callback. |
| Xero access/refresh tokens | Deleted immediately on disconnect; otherwise retained for the life of the connection. |
| User accounts | Retained until the firm requests deletion or the user is removed. |
| Email send log | 90 days. |
| Rate-limit buckets | 24 hours rolling. |

## Deletion on request

Customer data deletion requests are handled within 30 days by an admin performing the corresponding cascade delete on the firm or user row. The action is recorded in the audit log.

## Backups

Database backups are managed by Lovable Cloud / Supabase. Restoring from a backup will restore deleted data; deletion requests therefore include flagging the customer in case of a restore.
