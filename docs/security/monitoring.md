# Security monitoring

## Layers

- **Application**: structured server logs from every server function and route; Cloudflare WAF in front of all traffic.
- **Network**: Cloudflare DDoS and bot protection. All inbound traffic terminates at Cloudflare.
- **Infrastructure**: Supabase platform monitoring (CPU, queries, errors). Lovable Cloud monitors the Worker runtime.
- **Transaction (data)**: Append-only `audit_log` records connect, disconnect, sync, token refresh, role changes and admin actions.

## Tooling

- Lovable security scanner runs on every change and surfaces RLS/GRANT misconfigurations.
- Supabase linter runs after every migration.
- Rate-limit buckets (`rate_limit_buckets`) throttle high-risk endpoints (Xero connect start, invite sending, password reset).

## Logging

- Audit-relevant operations call `audit_log` inserts directly from server functions.
- Login events are captured to `login_events`.
- Provider errors are logged server-side; user-facing errors do not leak upstream payloads.
