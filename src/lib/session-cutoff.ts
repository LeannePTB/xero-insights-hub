/**
 * Session controls — the browser-side mirror.
 *
 * Owner decision, 15 September 2026: the daily forced sign-in (a 3am
 * Australia/Sydney cut-off) was REMOVED. The inactivity timeout addresses the
 * stolen-device threat directly, while a daily cut-off added friction without
 * covering it. Nothing here expires a session because of the calendar; the only
 * automatic end is inactivity, and the enforcement lives on the server and in
 * the database.
 */

/**
 * Inactivity timeout (owner decision, 15 September 2026). Thirty minutes of no
 * real interaction ends the session; the warning appears one minute before.
 *
 * These are the browser-side mirror of the SAME window enforced inside the
 * database by `app_private.is_session_active()` and by the request middleware
 * against the server-held `session_activity.last_activity_at`. The browser may
 * only ever sign out EARLIER — it is never the control.
 */
export const INACTIVITY_WINDOW_MINUTES = 30;
export const INACTIVITY_WARN_AT_MINUTES = 29;
export const INACTIVITY_WINDOW_MS = INACTIVITY_WINDOW_MINUTES * 60_000;
export const INACTIVITY_WARN_AT_MS = INACTIVITY_WARN_AT_MINUTES * 60_000;

/** Shared absolute deadline, so every tab of one session expires together. */
export const IDLE_DEADLINE_KEY = "ta:idle-deadline";
/** Cross-tab channel: activity extends, expiry ends, in every open tab. */
export const SESSION_CHANNEL = "ta:session";

/**
 * One-shot reason hint so the sign-in page can say why the session ended.
 * Display text only, never a credential and never a grant. Deliberately
 * DISTINCT from any MFA prompt: an ended session needs a fresh sign-in, not an
 * authenticator code.
 *
 * Two reasons, because they are two different truths:
 * - "idle": the browser counted 30 minutes without interaction and ended it.
 * - "ended": the SERVER refused the session (SESSION_IDLE). This covers the
 *   case the owner hit during a client demo — a session the database would no
 *   longer accept, previously surfacing as "Admin access required" or a
 *   generic failure. It must never be a dead end and never blame access.
 */
export const SIGN_IN_IDLE_KEY = "ta:signout-reason-idle";

export type SignOutReason = "idle" | "ended";

function markSignedOut(reason: SignOutReason) {
  try {
    window.localStorage.setItem(SIGN_IN_IDLE_KEY, reason);
  } catch {}
}

export function markSignedOutIdle() {
  markSignedOut("idle");
}

/** The server refused this session; we cannot always tell why, only that it ended. */
export function markSessionEnded() {
  markSignedOut("ended");
}

export function takeSignOutReason(): SignOutReason | null {
  try {
    const raw = window.localStorage.getItem(SIGN_IN_IDLE_KEY);
    window.localStorage.removeItem(SIGN_IN_IDLE_KEY);
    if (raw === "ended") return "ended";
    // "1" is the pre-existing marker written by older cached builds.
    if (raw === "idle" || raw === "1") return "idle";
    return null;
  } catch {
    return null;
  }
}

/** Text shown on the sign-in page after an inactivity sign-out. */
export const IDLE_SIGN_OUT_MESSAGE = `Signed out after ${INACTIVITY_WINDOW_MINUTES} minutes of inactivity`;

/** Text shown when the server ended the session, whatever the underlying reason. */
export const SESSION_ENDED_MESSAGE = "Your session ended — please sign in again.";

export function signOutMessage(reason: SignOutReason): string {
  return reason === "idle" ? IDLE_SIGN_OUT_MESSAGE : SESSION_ENDED_MESSAGE;
}

export function readIdleDeadline(): number | null {
  try {
    const raw = Number(window.localStorage.getItem(IDLE_DEADLINE_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function writeIdleDeadline(at: number) {
  try {
    window.localStorage.setItem(IDLE_DEADLINE_KEY, String(at));
  } catch {}
}

export function clearIdleDeadline() {
  try {
    window.localStorage.removeItem(IDLE_DEADLINE_KEY);
  } catch {}
}
