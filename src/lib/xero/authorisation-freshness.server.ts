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
// (b) is SCOPED: a page load may only ever touch the connections that page is
// about — the client's own Xero files, or the tenants the caller can already
// see on the connections screen. It must never reach another organisation's
// rows or spend another organisation's token (invariant 4, §10). The nightly
// job is the only global pass, because it is a scheduled job rather than a
// user request.
//
// (b) must also never turn into a Xero call per page load, per card or per
// tab, so it is rate limited in the database: a single conditional UPDATE
// stamps xero_connections.authorisation_checked_at on the rows IN SCOPE and
// returns the rows it claimed. Postgres applies that UPDATE atomically, so
// only one caller can win the claim within the window — every other tab, card
// or request for the same scope sees the fresh stamp and does nothing. Because
// the stamp lives on the connection row itself, the window is inherently
// per scope: one organisation's check cannot suppress another's. The stamp is
// written BEFORE the Xero call, so a slow call cannot let a second caller
// through.
//
// Fail-closed behaviour is untouched: reconcileAuthorisedTenants leaves every
// row alone on an errored or empty /connections response.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** At most one GET /connections per scope per this window. */
const CACHE_MS = 10 * 60 * 1000;

/**
 * What the caller's request is actually about. There is no "everything"
 * option on purpose — a page load must name its scope.
 */
export type FreshnessScope =
  /** One client's Xero files (a client page). */
  | { clientId: string }
  /** Specific tenants the caller can already see (the connections screen). */
  | { tenantIds: string[] };

async function reconcile(userIds: string[], connectionIds: string[]) {
  const { reconcileAuthorisedTenants } = await import("./authorised-tenants.server");
  return reconcileAuthorisedTenants(userIds, connectionIds);
}

async function stamp(userIds: string[]) {
  await (supabaseAdmin as any)
    .from("xero_connections")
    .update({ authorisation_checked_at: new Date().toISOString() })
    .in("user_id", userIds);
}

/** Resolve a scope to the tenant ids it covers. Never widens beyond it. */
async function tenantIdsForScope(scope: FreshnessScope): Promise<string[]> {
  if ("tenantIds" in scope) {
    return [...new Set(scope.tenantIds.filter((t) => typeof t === "string" && t.length > 0))];
  }
  const { data, error } = await (supabaseAdmin as any)
    .from("client_xero_orgs")
    .select("xero_connections(tenant_id)")
    .eq("client_id", scope.clientId);
  if (error) return [];
  return [
    ...new Set(
      ((data ?? []) as any[])
        .map((l) => l?.xero_connections?.tenant_id)
        .filter((t): t is string => typeof t === "string" && t.length > 0),
    ),
  ];
}

/**
 * Lazy, rate-limited, SCOPED reconcile for status-bearing screens.
 *
 * Fire-and-forget: callers must NOT await this. It never throws, never blocks
 * rendering, and the page always renders with the status we already hold.
 */
export function ensureAuthorisationFresh(scope: FreshnessScope): void {
  void (async () => {
    try {
      const tenantIds = await tenantIdsForScope(scope);
      if (tenantIds.length === 0) return;

      const cutoff = new Date(Date.now() - CACHE_MS).toISOString();
      // Atomic claim, confined to the scope: stamp first, act second.
      const { data, error } = await (supabaseAdmin as any)
        .from("xero_connections")
        .update({ authorisation_checked_at: new Date().toISOString() })
        .in("tenant_id", tenantIds)
        .or(`authorisation_checked_at.is.null,authorisation_checked_at.lt.${cutoff}`)
        .select("id, user_id");
      if (error) return;

      const claimed = (data ?? []) as Array<{ id: string; user_id: string | null }>;
      const connectionIds = claimed.map((r) => r.id).filter(Boolean);
      const userIds = [
        ...new Set(claimed.map((r) => r.user_id).filter((id): id is string => !!id)),
      ];
      if (userIds.length === 0 || connectionIds.length === 0) return;
      // Only the rows this caller claimed may be changed, even though the
      // token covers more tenants than the scope.
      await reconcile(userIds, connectionIds);
    } catch {
      // Best-effort only; the held status stands.
    }
  })();
}

/**
 * Immediate reconcile after a reconnect, for one user. Awaited, but bounded
 * and never allowed to fail the reconnect. This is the consent event itself,
 * so it covers that user's own connections rather than a page's scope.
 */
export async function reconcileAfterConnect(userId: string, budgetMs = 8000): Promise<void> {
  try {
    await Promise.race([
      (async () => {
        const { reconcileAuthorisedTenants } = await import("./authorised-tenants.server");
        await reconcileAuthorisedTenants([userId]);
        await stamp([userId]);
      })(),
      new Promise((resolve) => setTimeout(resolve, budgetMs)),
    ]);
  } catch {
    // A reconnect must succeed even if this check cannot run.
  }
}
