// Manual "re-sync now" from Xero.
//
// Access: AAL2, then the caller-scoped database manage predicate
// (public.me_can_manage_client → app_private.user_can_write_client). Read-only
// paths — support grants, external advisers, business owners — are refused.
// A tenantId or clientId in the request is a FILTER, never a GRANT (invariant 4).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";
import type { ResyncOutcome } from "./resync-reasons";

const NOT_ALLOWED = "You can't re-sync this client.";

async function assertCanManage(supabase: any, clientId: string | null): Promise<string> {
  if (!clientId) throw new Error(NOT_ALLOWED);
  const { data, error } = await supabase.rpc("me_can_manage_client", { _client_id: clientId });
  if (error || data !== true) throw new Error(NOT_ALLOWED);
  return clientId;
}

/** Rate limits + run for one tenant. Same keys as before, so every caller shares one budget. */
async function runTenant(tenantId: string): Promise<{ outcome: ResyncOutcome }> {
  const { MANUAL_REFRESH_MAX, MANUAL_REFRESH_WINDOW_SECONDS, TENANT_RUN_MAX, TENANT_RUN_WINDOW_SECONDS } =
    await import("./snapshot-keys");
  const { enforceRateLimit } = await import("@/lib/rate-limit.server");
  try {
    await enforceRateLimit(`xero_snapshot_manual:${tenantId}`, MANUAL_REFRESH_MAX, MANUAL_REFRESH_WINDOW_SECONDS);
    await enforceRateLimit(`xero_snapshot_tenant:${tenantId}`, TENANT_RUN_MAX, TENANT_RUN_WINDOW_SECONDS);
  } catch {
    return { outcome: "cooldown" };
  }
  const { resolveRefreshTarget, refreshTenant } = await import("./snapshot-refresh.server");
  const target = await resolveRefreshTarget(tenantId);
  if (!target) return { outcome: "reconnect" };
  // Same per-tenant claim as the scheduled run, so the two cannot overlap.
  const result = await refreshTenant(target, "manual");
  if (result.status === "skipped") return { outcome: "cooldown" };
  if (result.status === "complete") return { outcome: "complete" };
  if (result.status === "partial") return { outcome: "partial" };
  const { outcomeFromFailure } = await import("./resync-reasons");
  return { outcome: outcomeFromFailure(result.reason) };
}

/** Client dashboard "Refresh figures" — one Xero file. */
export const refreshXeroSnapshots = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input: unknown) => z.object({ tenantId: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: clientId } = await (context.supabase as any).rpc("client_for_tenant", { _tenant_id: data.tenantId });
    await assertCanManage(context.supabase, (clientId as string | null) ?? null);
    const { outcome } = await runTenant(data.tenantId);
    if (outcome === "cooldown") throw new Error("Too many requests. Please wait a moment and try again.");
    if (outcome === "reconnect" || outcome === "failed" || outcome === "rate_limited") {
      const { RESYNC_REASON } = await import("./resync-reasons");
      throw new Error(RESYNC_REASON[outcome]);
    }
    return { status: outcome };
  });

const ORDER: ResyncOutcome[] = ["complete", "partial", "cooldown", "not_connected", "failed", "rate_limited", "reconnect"];

/** Overview re-sync — every linked Xero file of one client. */
export const resyncClient = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input: unknown) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ outcome: ResyncOutcome }> => {
    const sb = context.supabase as any;
    const clientId = await assertCanManage(sb, data.clientId);

    // Tenants resolved server-side, as the caller (RLS applies).
    const { data: links, error } = await sb
      .from("client_xero_orgs")
      .select("xero_connections(tenant_id, status)")
      .eq("client_id", clientId);
    if (error) throw new Error("Could not read this client's Xero connections.");
    const conns = ((links ?? []) as any[]).map((l) => l.xero_connections).filter(Boolean);

    let outcome: ResyncOutcome;
    if (!conns.length) outcome = "not_connected";
    else {
      const outcomes: ResyncOutcome[] = [];
      for (const c of conns) {
        if (c.status !== "connected") { outcomes.push("reconnect"); continue; }
        outcomes.push((await runTenant(c.tenant_id)).outcome);
        if (outcomes[outcomes.length - 1] === "rate_limited") break;
      }
      // Worst outcome wins so a problem is never hidden.
      outcome = outcomes.reduce((w, o) => (ORDER.indexOf(o) > ORDER.indexOf(w) ? o : w), "complete" as ResyncOutcome);
    }

    const { writeAudit } = await import("@/lib/audit.server");
    const { data: client } = await sb.from("clients").select("firm_id").eq("id", clientId).maybeSingle();
    await writeAudit({
      actorUserId: context.userId,
      firmId: client?.firm_id ?? null,
      action: "xero_manual_resync",
      targetType: "client",
      targetId: clientId,
      meta: { outcome, files: conns.length },
    });
    return { outcome };
  });
