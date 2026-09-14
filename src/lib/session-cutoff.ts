/**
 * Daily sign-in cut-off: everyone must hold a session created after the most
 * recent 3am Australia/Sydney. The database (app_private.assert_aal2) and the
 * server middleware enforce this; the helpers here are the browser-side mirror
 * so the app can sign out and redirect cleanly instead of failing mid-action.
 *
 * The browser stores ONLY a timestamp hint (when sign-in completed). It is a
 * UX hint, never a grant: enforcement lives on the server.
 */

export const SIGN_IN_AT_KEY = "ta:signin-at";

/** Most recent 3am Australia/Sydney, as a UTC instant. Handles AEST/AEDT. */
export function dailySignInCutoff(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const y = part("year");
  const m = part("month");
  const d = part("day");

  // 03:00 Sydney wall-clock on that date → UTC. Estimate with the Sydney
  // offset in effect at that moment (toLocaleString round-trip).
  const utcGuess = Date.UTC(y, m - 1, d, 3);
  const sydneyWall = new Date(
    new Date(utcGuess).toLocaleString("en-US", { timeZone: "Australia/Sydney" }),
  ).getTime();
  const offsetMs = sydneyWall - utcGuess;
  const cutoff = new Date(utcGuess - offsetMs);

  // Before 3am in Sydney: the relevant cut-off is yesterday's.
  if (cutoff.getTime() > now.getTime()) {
    return dailySignInCutoff(new Date(now.getTime() - 24 * 3600 * 1000));
  }
  return cutoff;
}

export function markSignInNow(now: Date = new Date()) {
  try {
    window.localStorage.setItem(SIGN_IN_AT_KEY, String(now.getTime()));
  } catch {}
}

export function clearSignInMark() {
  try {
    window.localStorage.removeItem(SIGN_IN_AT_KEY);
  } catch {}
}

/**
 * True when the browser has no record of a sign-in after the most recent 3am
 * Sydney. Missing record = stale (fail closed; a genuine fresh sign-in always
 * writes the mark via the SIGNED_IN listener).
 */
export function isSessionStale(now: Date = new Date()): boolean {
  let signedInAt = NaN;
  try {
    signedInAt = Number(window.localStorage.getItem(SIGN_IN_AT_KEY));
  } catch {
    return true;
  }
  if (!Number.isFinite(signedInAt)) return true;
  return signedInAt < dailySignInCutoff(now).getTime();
}
