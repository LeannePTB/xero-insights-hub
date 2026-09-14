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
 * When the SESSION behind an access token began, in ms. Read from the token's
 * `amr` entries (the password and MFA steps), which survive hourly refreshes;
 * `iat` is only a last-resort fallback. Mirrors the server middleware. The
 * signature is never checked here: this can only ever DENY earlier than the
 * database, which applies the same cut-off against auth.sessions.
 */
export function sessionStartedAtMsFromToken(accessToken: string): number | null {
  const parts = accessToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="))) as {
      iat?: unknown;
      amr?: unknown;
    };
    const stamps = Array.isArray(json.amr)
      ? json.amr
          .map((e) =>
            e && typeof e === "object" && typeof (e as { timestamp?: unknown }).timestamp === "number"
              ? (e as { timestamp: number }).timestamp
              : null,
          )
          .filter((n): n is number => n !== null)
      : [];
    if (stamps.length > 0) return Math.min(...stamps) * 1000;
    return typeof json.iat === "number" ? json.iat * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * True when the session behind this access token began before the most recent
 * 3am Sydney. The token itself is the source of truth, so a lost or cleared
 * browser hint can never lock a freshly signed-in person out. A token we cannot
 * read at all is treated as fresh here and refused by the server and database
 * instead — the browser layer may only deny earlier, never be the control.
 */
export function isTokenStale(accessToken: string | null | undefined, now: Date = new Date()) {
  if (!accessToken) return false;
  const startedAt = sessionStartedAtMsFromToken(accessToken);
  if (startedAt === null) return false;
  return startedAt < dailySignInCutoff(now).getTime();
}

/**
 * Legacy browser-hint check, kept for the sign-in timestamp written at
 * SIGNED_IN. Only consulted as a secondary signal now: a missing hint is NOT
 * treated as stale, because preview/partitioned storage can lose it.
 */
export function isSessionStale(now: Date = new Date()): boolean {
  let signedInAt = NaN;
  try {
    signedInAt = Number(window.localStorage.getItem(SIGN_IN_AT_KEY));
  } catch {
    return false;
  }
  if (!Number.isFinite(signedInAt) || signedInAt <= 0) return false;
  return signedInAt < dailySignInCutoff(now).getTime();
}

/**
 * One-shot hint that the last session ended because of the daily cut-off, so
 * the sign-in page can explain why. Display text only — never a credential.
 */
export const SIGN_IN_EXPIRED_KEY = "ta:signin-expired";

export function markSignInExpired() {
  try {
    window.localStorage.setItem(SIGN_IN_EXPIRED_KEY, "1");
  } catch {}
}

export function takeSignInExpired(): boolean {
  try {
    const had = window.localStorage.getItem(SIGN_IN_EXPIRED_KEY) === "1";
    window.localStorage.removeItem(SIGN_IN_EXPIRED_KEY);
    return had;
  } catch {
    return false;
  }
}
