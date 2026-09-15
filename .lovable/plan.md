# Session controls: inactivity timeout + remote sign-out

Classification: **SECURITY-RELEVANT** (auth/MFA session lifetime, definer functions, `supabaseAdmin`, audit log). Threat: a stolen or unattended laptop/phone with a live session. Invariants touched: 1 (fail closed), 2 (enforced on the server and in the database, browser is UX only), 6 (one implementation, in the database), 7 (admin client only where the platform requires it), 8 (no tokens leave the server). The daily 3am cut-off is untouched.

## Platform capability (checked before planning, so Part B is real)

- `POST /auth/v1/admin/users/{id}/logout` with the service-role key exists on this project: probing a non-existent user returned `404 user_not_found`, i.e. the route is live, not missing. That endpoint deletes the user's `auth.sessions` rows — genuine server-side revocation, not browser clearing.
- Self "other devices" uses `supabase.auth.signOut({ scope: 'others' })`, which is GoTrue `/logout?scope=others` with the caller's own bearer — again server-side session deletion.
- Proof planned: read `count(*) from auth.sessions where user_id = …` before and after, and confirm the old access token is refused afterwards.

## Part A — 30 minute inactivity timeout

One named constant beside the daily cut-off: `INACTIVITY_WINDOW_MINUTES = 30`, `INACTIVITY_WARN_AT_MINUTES = 29` in `src/lib/session-cutoff.ts`, mirrored by a single SQL constant inside the new database helper.

**Server-held timestamp (the control).** New table `public.session_activity` (`session_id` uuid PK, `user_id`, `last_activity_at`) — RLS on, `revoke all from anon, authenticated`, per-command policies naming the role, owner-scoped read only, no direct writes. Written **only** by a definer function `public.touch_session_activity()` (aal2, caller-scoped, session id taken from the JWT claim, never a parameter). The browser can never set the value or the time.

**What counts as activity.** The only caller of `touch_session_activity` is a browser activity tracker on real interaction: pointerdown, keydown, router navigation, and a completed user-initiated mutation. Debounced to at most one call per 60 s. Explicitly excluded: the presence heartbeat (`recordPresence`), snapshot refresh, token refresh, and any polling query — they call other server functions and never touch this table, so an open idle tab expires on time.

**Enforcement.** `app_private.is_session_active()` (definer, `SET search_path`, EXECUTE revoked from PUBLIC/anon) returns true when `greatest(auth.sessions.created_at, session_activity.last_activity_at) > now() - 30 min`; unverifiable → false (fail closed); service-role/system contexts pass, as with the daily check. `app_private.is_aal2()` and `app_private.assert_aal2()` consult it exactly as they consult `is_session_fresh()`, so the restrictive aal2 policy hides every row on every data table and definer functions raise `SESSION_IDLE`. The `src/start.ts` request middleware also refuses idle sessions by reading the same server-held timestamp (never a browser-supplied value), so the RPC layer denies before the query runs.

**Browser layer (may only sign out earlier).** A `useIdleTimeout` hook: deadline kept in `localStorage` so every tab of the same session shares one deadline, plus a `BroadcastChannel` so a timeout in one tab ends the others. Warning dialog at 29 minutes with a live countdown and "Stay signed in" (which calls `touch_session_activity`). On expiry: shared sign-out, `ta:signout-reason=idle`, land on `/auth`. A reopened laptop is expired on the first tick because the deadline is an absolute timestamp, and the server refuses regardless.

**No dead end** (the 3am lesson): `/auth` shows "Signed out after 30 minutes of inactivity" and always offers a fresh sign-in form — never a lone "Continue" on a session the server will reject.

## Part B — remote sign-out

- `public.admin_sign_out_all_devices(_user_id uuid)` — definer, aal2 + super admin asserted first, audited (`sessions_revoked_all`, meta: actor, subject, when; never a token). It records the intent and authorises; the actual revocation is the admin logout endpoint called from `src/lib/sessions.server.ts` via the registered admin client after the database authorised the caller. Button on `/settings/advisors` per person.
- Self-service: "Sign out my other devices" on `/settings/account` → `signOut({ scope: 'others' })` plus an audited `sessions_revoked_others` row through the caller's own session.
- Lockout question: revoking sessions does not touch credentials or MFA factors, so a signed-out super admin signs straight back in. Nobody can be locked out; this is reported as a finding rather than a guard, and the audited function refuses `auth.uid()` as its own subject for the admin path (use the self control instead).

## Part C — provable

- Posture check `session_controls` appended by `public.security_posture()`: reports the daily cut-off time, the live inactivity window read from the helper source, and whether `is_aal2`/`assert_aal2` actually reference the idle check — all computed live, Action if mirroring is absent.
- Matrix rows: idle session refused by server and database; non-super-admin cannot sign out another person; a person can sign out their own other devices; both write audit rows.
- Docs in the same change: `access-control-spec.md` (new session-management section covering all three controls), `xero-assessment-inputs.md`, `definer-purposes.ts` + regenerated register, `admin-client-register.md` (new admin use), `automated-checks.md`, `security-backlog.md`.

## Verification before reporting

Fixture regenerate + fingerprint, access matrix `--check`, definer register `--check`, `bun run security:check` totals, live access suite, `bunx tsc --noEmit`, backend linter delta, and the before/after `auth.sessions` count proving revocation.
