import { supabase } from "@/integrations/supabase/client";
import { clearIdleDeadline, markSessionEnded } from "@/lib/session-cutoff";

/**
 * One place that turns a server "SESSION_IDLE" answer into a clean ending.
 *
 * Why this exists: the database refuses an idle session on every table and
 * every guarded function, so the refusal can surface anywhere — a dashboard
 * card, a saved report, an admin page. On 15 September 2026 the owner met that
 * refusal during a client demo and was shown "Admin access required", which was
 * both alarming and untrue: her session had simply ended. Nothing about
 * authorisation changes here; only what she is told.
 *
 * NOT an authorisation decision: this never grants anything and never suppresses
 * a refusal. It signs out and lands on the sign-in form with the plain reason.
 */
export function isSessionEndedError(err: unknown): boolean {
  const message =
    err == null
      ? ""
      : typeof err === "string"
        ? err
        : String((err as { message?: unknown }).message ?? "");
  return /SESSION_IDLE/i.test(message);
}

let ending = false;

export function endSessionAndSignIn() {
  if (ending || typeof window === "undefined") return;
  ending = true;
  clearIdleDeadline();
  markSessionEnded();
  void (async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* the session is already refused; local sign-out is enough */
    }
    // A full navigation, not a router push: every cached query for the ended
    // session is discarded, so no page can render half-refused data.
    window.location.assign("/auth");
  })();
}

/** Returns true when it handled the error by ending the session. */
export function handleIfSessionEnded(err: unknown): boolean {
  if (!isSessionEndedError(err)) return false;
  endSessionAndSignIn();
  return true;
}
