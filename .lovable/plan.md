# Session end: clean experience, visible failures, coverage alert

Owner decision, 15 September 2026. Classification: SECURITY-RELEVANT (session
authorisation surface), but **no authorisation change**: what the database
accepts and refuses is byte-for-byte the same before and after.

## Honest statement of what changes

"Good identity, no activity record, session older than the window" already
resolves to **refused** today, and stays refused. This change does not alter
that answer. It changes three other things: what the person sees when it
happens, whether the failure is visible to us within minutes, and whether we
are told that live sessions are not recording at all.

## 1. Unreadable session identity — unchanged

`app_private.is_session_active()` still returns false when the token carries no
readable `session_id`. Not touched.

## 2. A refused session ends cleanly, never a dead end

- Any `SESSION_IDLE` answer reaching the browser — from a card, a server
  function, a mutation, anywhere — signs the person out and lands them on the
  sign-in form with "Your session ended — please sign in again."
- Wired once at the query client, so no page can turn it into "Admin access
  required" or a generic failure.
- `/auth` asks the server whether an existing session is still active before
  offering "Continue"; if it is not, it signs it out and shows the form with
  the same wording.

## 3. Failures are visible, not swallowed

- A failed activity write is logged server-side with its reason.
- A request-layer refusal is logged with its reason.
- Neither log carries a token, session id or email.

## 4. Coverage alert

`session_controls_posture()` additionally reports live sessions that are past
the window with no activity record — the exact condition that produced this
morning's outage. Zero is the healthy state; any count raises a Warn with the
number and the oldest one, so a broken recorder shows up on the Security page
in minutes rather than as a lockout.

Warn rather than Action deliberately: one person who signed in before the fix
shipped is a stale session, not a broken control. A count that keeps climbing
is what matters.

## Verification

`bun run security:check` (fingerprint, tests, live access), posture, linter.
Every existing matrix row must still pass unchanged; no new or altered rows,
because no access rule moves.
