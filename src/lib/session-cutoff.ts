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

/**
 * Where to send someone back to after they sign in again (owner decision,
 * 13 October 2026): when a session ends by INACTIVITY — browser-counted or
 * server-refused — remember the page they were on, so signing back in returns
 * them there instead of always landing on the dashboard. A deliberate Sign out
 * never sets this.
 *
 * Presentation only, never a grant: the value is a same-origin path, validated
 * on read, and every destination route keeps its own server-side guard.
 */
export const RETURN_TO_KEY = "ta:return-to";

function isSafeReturnPath(path: string): boolean {
  // Same-origin absolute path only: no "//host", no scheme, no backslashes.
  return /^\/[^\\/]/.test(path) && !path.startsWith("//");
}

export function writeReturnTo(path: string) {
  try {
    if (isSafeReturnPath(path)) window.localStorage.setItem(RETURN_TO_KEY, path);
  } catch {}
}

/** Read once and clear. Returns null when nothing safe is stored. */
export function takeReturnTo(): string | null {
  try {
    const raw = window.localStorage.getItem(RETURN_TO_KEY);
    window.localStorage.removeItem(RETURN_TO_KEY);
    return raw && isSafeReturnPath(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** The page to land on after a successful sign-in (incl. its MFA step). */
export function postAuthDestination(): string {
  return takeReturnTo() ?? "/dashboard";
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
