// Keeps connection status honest for someone actually looking at a screen.
//
// The nightly reconcile (3:05am Sydney) is correct but slow to react: a
// consent that drops organisations leaves rows reading `connected` all day.
// Two extra triggers use the SAME reconcile logic:
//
//   a. right after an OAuth callback stores tokens (the exact moment the
//      grant changes), and
//   b. lazily, when a screen that reports Xero connectivity is loaded.
//
// (b) must never turn into a Xero call per page load, per card or per tab, so
// it is rate limited in the database: a single conditional UPDATE stamps
// xero_connections.authorisation_checked_at and returns the rows it claimed.
// Postgres applies that UPDATE atomically, so only one caller can win the
// claim within the window — every other tab, card or request sees the fresh
// stamp and does nothing. The stamp is written BEFORE the Xero call, so a slow
// call cannot let a second caller through.
//
// Fail-closed behaviour is untouched: reconcileAuthorisedTenants leaves every
// row alone on an errored or empty /connections response.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** At most one GET /connections per Xero user account per this window. */
const CACHE_MS = 10 * 60 * 1000;

async function reconcile(userIds: string[]) {
  const { reconcileAuthorisedTenants } = await import("./authorised-tenants.server");
  return reconcileAuthorisedTenants(userIds);
}

async function stamp(userIds: string[]) {
  await (supabaseAdmin as any)
    .from("xero_connections")
    .update({ authorisation_checked_at: new Date().toISOString() })
    .in("user_id", userIds);
}

/**
 * Lazy, rate-limited reconcile for status-bearing screens.
 *
 * Fire-and-forget: callers must NOT await this. It never throws, never blocks
 * rendering, and the page always renders with the status we already hold.
 */
export function ensureAuthorisationFresh(): void {
  void (async () => {
    try {
      const cutoff = new Date(Date.now() - CACHE_MS).toISOString();
      // Atomic claim: stamp first, act second.
      const { data, error } = await (supabaseAdmin as any)
        .from("xero_connections")
        .update({ authorisation_checked_at: new Date().toISOString() })
        .or(`authorisation_checked_at.is.null,authorisation_checked_at.lt.${cutoff}`)
        .select("user_id");
      if (error) return;
      const userIds = [...new Set(((data ?? []) as Array<{ user_id: string | null }>)
        .map((r) => r.user_id)
        .filter((id): id is string => !!id))];
      if (userIds.length === 0) return;
      await reconcile(userIds);
    } catch {
      // Best-effort only; the held status stands.
    }
  })();
}

/**
 * Immediate reconcile after a reconnect, for one user. Awaited, but bounded
 * and never allowed to fail the reconnect.
 */
export async function reconcileAfterConnect(userId: string, budgetMs = 8000): Promise<void> {
  try {
    await Promise.race([
      (async () => {
        await reconcile([userId]);
        await stamp([userId]);
      })(),
      new Promise((resolve) => setTimeout(resolve, budgetMs)),
    ]);
  } catch {
    // A reconnect must succeed even if this check cannot run.
  }
}
