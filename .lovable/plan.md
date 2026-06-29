# Security recheck — final pass before Xero submission

## Current state

All scanners are clean except one Supabase linter warning:

- **`public.me_is_super_admin()` is executable by `authenticated`** (lint 0029, `SECURITY DEFINER` callable by signed-in users).

Everything else passes:
- Connector security scan: 0 findings
- Supabase RLS/GRANT scan: 0 findings
- Lovable Supabase scan: 0 findings
- Supply-chain scan: 0 findings
- All other `SECURITY DEFINER` functions in `public` have `EXECUTE` revoked from `authenticated` and `anon` (verified via `pg_proc`).
- `has_role` / `is_super_admin` live in the locked-down `app_private` schema (not exposed via PostgREST).

## Why `me_is_super_admin` stays executable

It's the only function the browser RPCs directly (`supabase.rpc('me_is_super_admin')`) to decide whether to render Super-admin UI, and every server function gates on the same RPC before doing privileged work. The function:

- Takes no arguments.
- Reads only `auth.uid()` (the caller's own id) against `public.user_roles`.
- Returns a single boolean about the caller — no other user's data, no enumeration, no side effects.
- Cannot be used to elevate privileges; it just reports a fact the caller already has.

Revoking `EXECUTE` would break the Super-admin console and every server-side `assertSuperAdmin` check, with no security gain.

## Plan

1. **Mark the linter finding as accepted** via `security--manage_security_finding` (op `ignore`) with the rationale above, so it doesn't keep appearing in future scans/exports.
2. **Update `@security-memory`** so future scans know this exposure is intentional, and record the boundary (only `me_is_super_admin` is exposed to `authenticated`; any new `SECURITY DEFINER` function in `public` must default to `REVOKE EXECUTE FROM authenticated, anon`).
3. **Re-run `security--run_security_scan`** to confirm a fully clean report you can attach to the Xero submission.
4. Reply with the clean scan summary so you have it ready to send.

No code or schema changes — this is purely closing out the warning and refreshing the security memory.
