## Problem

`/clients/:id` fails with `permission denied for table xero_connections`.

Root cause: NO public-schema tables have any GRANTs for `authenticated`, `service_role`, or `anon`. A previous hardening migration revoked every grant on every public table. RLS policies are correct, but PostgREST/Data API checks the role grant **before** RLS, so every browser query through `supabase.from(...)` now 403s. Server functions using `requireSupabaseAuth` (which acts as the `authenticated` role with a bearer token) also fail.

The reason the app worked anywhere is that `supabaseAdmin` queries bypass grants/RLS via the service role's superuser-equivalent bypass — but PostgREST sessions for `authenticated` and `service_role` both need explicit grants.

## Fix

One migration that restores grants on every public table to the roles each table's policies actually rely on. Two grant tiers:

**Standard (most tables — policies scope to `auth.uid()` / firm membership):**
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;
GRANT ALL ON public.<table> TO service_role;
```

Applies to: `clients`, `xero_connections`, `client_xero_orgs`, `client_access`, `client_cost_classifications`, `client_notes`, `client_true_breakeven_inputs`, `dashboard_card_order`, `dashboard_configs`, `firms`, `firm_members`, `profiles`, `user_roles`, `tier_settings`, `tier_widget_config`, `subscriptions`, `billing_events`, `unreconciled_lines`, `unreconciled_uploads`, `xero_assessment_contact`, `security_contact_details`, `audit_log`, `login_events`, `access_invites`, `signup_requests`, `report_cache`, `email_send_log`, `email_send_state`, `suppressed_emails`, `xero_oauth_states`.

**Service-role-only (no authenticated access; written by server/admin only):**
```sql
GRANT ALL ON public.<table> TO service_role;
```

Applies to: `rate_limit_buckets`, `email_unsubscribe_tokens` (token-hash lookups happen server-side).

No `anon` grants — there are no public-anon flows in the app.

## Verification

After the migration:
1. `\dp public.xero_connections` shows `authenticated=arwd` and `service_role=a*r*w*d*`.
2. Reload `/clients/0bdbfe31-...` — page loads, Xero connection list renders.
3. Spot-check `/admin`, `/settings/advisors`, dashboard widgets.

## Why this happened

The earlier "restrict super-admin / harden RLS" pass issued blanket `REVOKE ALL ... FROM authenticated, service_role` without re-granting the per-table privileges PostgREST needs. RLS = row filter; GRANT = table access. Both are required.
