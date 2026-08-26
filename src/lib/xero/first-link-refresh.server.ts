// One snapshot refresh when a Xero organisation is first linked to a client.
//
// Connection-time, not render-time: opening a dashboard must never be able to
// trigger a Xero run. This fires once, for one tenant, after the link row
// exists.
//
// It CANNOT block or fail the connection flow:
//  - every path is wrapped in try/catch and the promise is never awaited by
//    the caller's success path;
//  - a reconnect of a tenant that already has snapshot rows is a no-op, so it
//    does not re-run on every reconnect;
//  - it goes through the same claim (`claim_xero_snapshot_run`) and the same
//    throttles as any other refresh, so it cannot overlap the scheduled run
//    or exceed the per-tenant budget.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** True when this tenant already has at least one current snapshot row. */
async function hasSnapshots(tenantId: string): Promise<boolean> {
  const { data, error } = await (supabaseAdmin as any)
    .from("xero_snapshots")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  if (error) return true; // Unknown: treat as "already has", so we do nothing.
  return !!data;
}

/**
 * Fire-and-forget. Never throws, never rejects, never returns anything the
 * connection flow depends on.
 */
export function scheduleFirstLinkRefresh(tenantId: string): void {
  void (async () => {
    try {
      if (await hasSnapshots(tenantId)) return;

      const {
        MANUAL_REFRESH_MAX,
        MANUAL_REFRESH_WINDOW_SECONDS,
        TENANT_RUN_MAX,
        TENANT_RUN_WINDOW_SECONDS,
      } = await import("./snapshot-keys");
      const { enforceRateLimit } = await import("@/lib/rate-limit.server");
      await enforceRateLimit(
        `xero_snapshot_manual:${tenantId}`,
        MANUAL_REFRESH_MAX,
        MANUAL_REFRESH_WINDOW_SECONDS,
      );
      await enforceRateLimit(
        `xero_snapshot_tenant:${tenantId}`,
        TENANT_RUN_MAX,
        TENANT_RUN_WINDOW_SECONDS,
      );

      const { resolveRefreshTarget, refreshTenant } = await import("./snapshot-refresh.server");
      const target = await resolveRefreshTarget(tenantId);
      if (!target) return;
      await refreshTenant(target, "backfill");
    } catch (e) {
      // The connection succeeded; the dashboard shows "being prepared" until
      // the next refresh. Nothing here may surface to the user.
      console.warn(
        "[snapshot] first-link refresh skipped",
        e instanceof Error ? e.message.slice(0, 160) : String(e),
      );
    }
  })();
}
