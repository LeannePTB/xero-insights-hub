# Turn inactivity enforcement back on

Classification: **SECURITY-RELEVANT** — changes the aal2 gate, a guarded definer function, and therefore who can read rows on all 55 data tables. No access path, role or grant changes.

Invariants touched: 1 (deny by default), 2 (MFA enforced on the server), 9 (never loosen to fix a bug). Threat addressed: a stolen or walked-away-from device keeping a working session indefinitely.

## Where things stand

- Activity recording works. The owner's session began 02:35 and its last recorded activity is 04:05 — 90 minutes of continuous tracking. That is the defect from this morning, fixed and proven in the preview build.
- Database enforcement is off: the gate no longer consults the activity window.
- Request-layer enforcement is off behind an explicit switch.
- The browser-side 30-minute timeout with the one-minute warning is live and unchanged.
- One older session (signed in yesterday, never tracked) exists and would be refused the moment enforcement returns.

## Order of work

**Step 1 — publish first.** The corrected recording code only exists in the preview. Publishing puts it on the live site so every real session starts recording before anything can refuse one.

**Step 2 — confirm on the live site.** Sign in on tractionadvisory.com.au, use it for a few minutes, and confirm by query that a record exists for that session and its timestamp moves. Report the rows.

**Step 3 — add the missing positive tests.** The gap that caused this: every test proved refusal, none proved acceptance. Add a test persona for someone whose session began over 30 minutes ago but who was active two minutes ago, and assert they are **allowed** — a data read and the second-factor check both succeed. Keep the two existing proofs (genuinely idle is refused with a distinct inactivity answer, never a second-factor prompt; a brand-new session with no record yet is allowed from its start time).

**Step 4 — re-enable, in one migration.**
- The second-factor gate consults the activity window again.
- The assertion raises the distinct inactivity answer before any second-factor answer, so an idle person is told to sign in rather than sent to their authenticator app.
- The request-layer switch flips on.
- Update the live posture check, the access matrix, the security docs and the Xero mapping; close backlog item 51.

**Step 5 — verify and report.** Full check suite, posture, database linter, and a security report naming each proof.

## What the team will notice

Anyone signed in before the publish must sign in once more — their session has no activity history, so it will be treated as idle. Everyone signing in afterwards is tracked from the start. After 30 minutes with no clicks, typing or navigation, a warning appears at 29 minutes with "Stay signed in"; ignoring it signs them out with the plain reason.

## Owner test list (after step 4)

1. Sign in, work normally for 35 minutes — no interruption.
2. Sign in, leave the tab untouched for 29 minutes — warning appears; "Stay signed in" continues without re-entering anything.
3. Ignore the warning — signed out, sign-in page says signed out after 30 minutes of inactivity, never asks for an authenticator code as the reason.
4. Two tabs open — activity in one keeps both alive; expiry ends both.
5. Close the laptop for an hour, reopen — signed out immediately.

## Technical notes

- `app_private.is_aal2()` regains `and app_private.is_session_active()`; `is_session_active()` stays STABLE with a primary-key lookup on `public.session_activity` (measured 0.006 ms, index-only).
- `app_private.assert_aal2()` checks `is_session_active()` first and raises `SESSION_IDLE`; `MFA_REQUIRED` remains for genuine second-factor failures. Nothing else keys off the `MFA_REQUIRED` string.
- `ENFORCE_INACTIVITY_AT_REQUEST_LAYER` in `src/start.ts` → `true`.
- New matrix role `active_session_member`: `auth.sessions.created_at` 90 minutes ago, `session_activity.last_activity_at` 2 minutes ago; expected ALLOW on a client-scoped read and on `assert_aal2()`.
- `session_activity` and `session_is_active` stay on the documented aal2-guard exclusion list (circularity); no exclusion is widened.
- Step 4 is not applied in the same turn as steps 2–3 report back.
