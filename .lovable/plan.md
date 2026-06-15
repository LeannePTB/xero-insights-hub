# Phase 6b — Hide role helpers from the public API

## Goal

Stop anonymous and signed-in users from being able to call the 10 internal role/membership helper functions over the Cloud Data API (the `/rpc/...` endpoints). Today anyone can probe questions like "is user X the super-admin?" or "is user X a member of firm Y?" — pure reconnaissance, but easy to remove.

After this phase, the Lovable Cloud database linter should drop from 22 warnings to 0 (for codes 0028 and 0029).

## What changes (plain English)

- A new private database area (`app_private`) holds the helper functions.
- The Data API only exposes things in the `public` area, so once the helpers move, the `/rpc/has_role`, `/rpc/is_super_admin`, etc. endpoints simply stop existing.
- Row-level security policies keep working because they call the helpers by their new fully-qualified name (`app_private.has_role(...)`).
- App code that needs to ask "am I an admin?" goes through a thin server function instead of a direct API call — same answer, but the check happens server-side where we already know who's asking.
- No user-visible behaviour changes. No data migrates. No downtime.

## Helpers being moved

```text
has_role               is_advisor            get_user_firm_id
has_firm_access        is_super_admin        get_user_tier
has_client_access      is_firm_owner         get_tier_widgets
has_tenant_access
```

`check_rate_limit` is already locked down (service-role only) and can move alongside them for tidiness, or stay — no security difference.

## Steps

1. **Migration 1 — create the private home and copy the helpers.**
   - `CREATE SCHEMA app_private;`
   - Recreate each helper inside `app_private` with identical body and `SECURITY DEFINER`.
   - `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` on every new function; only `postgres` keeps execute.

2. **Migration 2 — repoint every RLS policy and every dependent DB function to `app_private.*`.**
   - Drop and recreate the affected policies (roughly: `firms`, `firm_members`, `subscriptions`, `billing_events`, `clients`, `xero_connections`, `client_xero_orgs`, `client_access`, `client_notes`, `dashboard_*`, `unreconciled_*`, `report_cache`, `audit_log`, `tier_*`, `signup_requests`, `access_invites`).
   - Update `handle_new_user`, `enforce_unreconciled_line_viewer_columns`, and `audit_user_roles_change` if they reference any helper by short name.

3. **Migration 3 — drop the old `public.*` helpers.**
   - Done after migrations 1 and 2 are live so nothing breaks mid-flight.

4. **App code touch-ups.**
   - Anywhere we call `supabase.rpc('has_role', ...)` or similar from a server function, switch to either a direct table check or a tiny `public.me_is_super_admin()` wrapper that's allowed to be called by authenticated users (returns only the caller's own answer — no `_user_id` parameter to probe with).
   - Likely callers: `promoteUser`-style admin fns in `src/lib/admin.functions.ts`, anywhere in `src/lib/access.functions.ts` that calls helpers via RPC, and the admin gate in invite/audit fns.

5. **Verify.**
   - Run the Lovable Cloud database linter — expect codes 0028/0029 cleared.
   - Smoke-test: sign in as the super-admin, open `/admin`, open a firm detail page; sign in as a firm owner, open `/dashboard`. All should behave identically.
   - Manual probe: from a logged-in browser, calling `/rest/v1/rpc/is_super_admin` should now return a "function not found" error instead of `true`/`false`.

## Technical details

- `SECURITY DEFINER` + `SET search_path = public` is preserved on each moved function so they keep reading `public.user_roles`, `public.firm_members`, etc.
- Policies use fully-qualified names: `USING (app_private.has_firm_access(auth.uid(), firm_id))`.
- For the small number of server-fn callsites that genuinely need "is current user a super-admin?", add one `public.me_is_super_admin()` returning `boolean` with no parameters — safe to expose because the caller can only ask about themselves, and they already know.
- All three migrations are pure schema changes (no data movement), idempotent, and reversible by re-creating the originals in `public`.

## Out of scope

- Stripe (Phase 3) — still parked.
- Enforcing the report-only CSP — separate hardening pass once we've watched the violation reports for a couple of weeks.
- Renaming the `advisor` role to `firm_owner` — separate cleanup.

## Phase 6b status — shipped

- New `app_private` schema holds the 10 role/membership helpers; old `public.*` copies dropped.
- Every RLS policy repointed to `app_private.*`.
- `enforce_unreconciled_line_viewer_columns` trigger now calls `app_private.is_advisor`.
- New `public.me_is_super_admin()` (no params, self-only) — used by admin/invite server fns.
- `src/lib/xero/access.server.ts` replaced its three RPC calls with direct table reads via service role.
- Trigger fns and email-queue helpers had EXECUTE revoked from anon/authenticated.
- Linter warnings: 22 → 1 (the remaining one is `me_is_super_admin`, intentionally exposed; documented in security memory).
