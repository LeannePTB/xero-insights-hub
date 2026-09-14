# Fix the "Guarded SECURITY DEFINER functions" Action

Classification: SECURITY-RELEVANT (callable definer function; daily sign-in cut-off logic).

## What the Action is actually telling us

The posture check scans every `public` SECURITY DEFINER function that signed-in
users may call and looks for the text `assert_aal2` / `is_aal2`. One function
does not contain it: `public.session_fresh()`.

It is a genuine exception, not a hole: it answers one yes/no question about the
caller's *own* session (did it start after the daily 3am sign-in cut-off) and
returns no organisation, client or personal data. It cannot call the aal2 guard,
because the guard itself depends on the freshness check — that would be circular.
It is already recorded as an approved exception in the definer register.

Nothing in the app calls it: the only reference is the generated types file.

## Fix

Remove `public.session_fresh()` entirely. Enforcement lives in
`app_private.is_session_fresh()`, which `app_private.is_aal2()` and
`app_private.assert_aal2()` both consult — dropping the public wrapper changes
nothing about who can read or write any row, and clears the Action honestly
rather than by widening the scanner's exclusion list.

## Second defect found while checking this

Both `public.session_fresh()` and `app_private.is_session_fresh()` compute the
cut-off as "today's date in Sydney, plus 3 hours". Between midnight and 3am
Sydney that timestamp is in the *future*, so every session — including one
signed in five minutes earlier — is treated as stale. During those three hours
each night the restrictive aal2 policy hides every row on every data table and
`assert_aal2()` raises `SESSION_EXPIRED`, so nobody can use the app and signing
in again does not help.

Fix `app_private.is_session_fresh()` to use the most recent 3am that has already
passed: if the current Sydney local time is before 3am, use yesterday's 3am.
Fail-closed behaviour is unchanged (no `session_id` claim, or no matching
`auth.sessions` row, is still stale; no request context and `service_role` still
pass).

## Technical detail

- Migration 1: `DROP FUNCTION public.session_fresh();`
- Migration 2: `CREATE OR REPLACE FUNCTION app_private.is_session_fresh()` with
  the corrected cut-off (`SECURITY DEFINER`, `SET search_path`, `EXECUTE`
  revoked from `PUBLIC` and `anon`, as now). No signature change, so
  `is_aal2()` / `assert_aal2()` need no edit.
- Docs in the same change: remove the `public.session_fresh()` rows from
  `docs/security/definer-register.md` and `docs/security/definer-purposes.ts`,
  correct the cut-off description in
  `docs/security/access-control-spec.md` section 0b, and append a
  `docs/security-backlog.md` entry for both items.
- No policy, grant or predicate changes; no table changes.

## Verification

- `public.security_posture()`: `definer_guards` back to ok; no new Action or Warn.
- Supabase linter: no new finding.
- `bun run security:check` (fixture fingerprint, access matrix, definer register
  `--check`, tests, live access suite) and `bunx tsc --noEmit`.
- Behaviour check that a session created just before midnight Sydney is stale
  after the next 3am, and that a session created at 1am is *not* stale.
- Security report at the end: invariants 1, 2, 6 and the evidence they hold.
