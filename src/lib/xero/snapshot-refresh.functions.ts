// Manual "refresh now" for one Xero organisation.
//
// Ships wired to no button. It exists so Stage 5 has a fast path that is not a
// second polling schedule; nothing in the UI calls it yet.
//
// Access: resolved server-side from the caller's identity via the existing
// assertWidgetAccess path. A tenantId in the request body is a FILTER, never a
// GRANT (invariant 4) — the caller must already be entitled to that tenant.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const refreshXeroSnapshots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }) => {
    const { assertWidgetAccess } = await import("./access.server");
    // Throws unless this user may see this tenant's data at all.
    await assertWidgetAccess(context.userId, data.tenantId, "health");

    const { MANUAL_REFRESH_MAX, MANUAL_REFRESH_WINDOW_SECONDS, TENANT_RUN_MAX, TENANT_RUN_WINDOW_SECONDS } =
      await import("./snapshot-keys");
    const { enforceRateLimit } = await import("@/lib/rate-limit.server");

    // One manual refresh per tenant per 2 minutes, plus an hourly tenant cap.
    await enforceRateLimit(`xero_snapshot_manual:${data.tenantId}`, MANUAL_REFRESH_MAX, MANUAL_REFRESH_WINDOW_SECONDS);
    await enforceRateLimit(`xero_snapshot_tenant:${data.tenantId}`, TENANT_RUN_MAX, TENANT_RUN_WINDOW_SECONDS);

    const { resolveRefreshTarget, refreshTenant } = await import("./snapshot-refresh.server");
    const target = await resolveRefreshTarget(data.tenantId);
    if (!target) throw new Error("This Xero organisation is not linked to a client.");

    // Same per-tenant claim as the scheduled run, so the two cannot overlap.
    const result = await refreshTenant(target, "manual");
    return {
      status: result.status,
      succeeded: result.succeeded,
      failed: result.failed,
      calls: result.calls,
    };
  });
