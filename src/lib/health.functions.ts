import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";
import type { HealthChecksResult } from "@/lib/health/health-checks.server";

export type { HealthChecksResult } from "@/lib/health/health-checks.server";

const uuid = z.string().uuid();

/**
 * Business Health card: three checks from stored figures only (never a live
 * Xero call). Entitlement is the card's own widget check; reads then run as
 * the caller, so RLS applies.
 */
export const getHealthChecks = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ tenantId: z.string().min(1).max(64), clientId: uuid }).strict().parse(i))
  .handler(async ({ data, context }): Promise<HealthChecksResult> => {
    const { assertWidgetAccess } = await import("./xero/access.server");
    await assertWidgetAccess(context.supabase, data.tenantId, "health");
    const { loadHealthChecks } = await import("@/lib/health/health-checks.server");
    const { sydneyDate } = await import("@/lib/sydney-time");
    const res = (await loadHealthChecks(context.supabase, [{ clientId: data.clientId, tenantId: data.tenantId }], sydneyDate())).get(data.clientId);
    if (!res) throw new Error("Business health could not be worked out.");
    const { logClientDataRead } = await import("@/lib/audit.server");
    logClientDataRead({ clientId: data.clientId, tenantId: data.tenantId, readKey: "health_checks", source: "snapshot", periodStart: null, periodEnd: res.asOf });
    return res;
  });

export type HealthBadgeSummary = { headline: string; onTrack: number; counted: number; checks: { question: string; status: string; figure: string }[] };

/**
 * Client-list badge: the same builder for every listed client in one batch of
 * stored-data reads. Zero Xero calls. Reads are RLS-scoped as the caller.
 */
export const listClientHealthChecks = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ clientIds: z.array(uuid).max(500) }).strict().parse(i))
  .handler(async ({ data, context }): Promise<{ results: Record<string, HealthBadgeSummary> }> => {
    const { loadHealthChecks } = await import("@/lib/health/health-checks.server");
    const { sydneyDate } = await import("@/lib/sydney-time");
    const map = await loadHealthChecks(context.supabase, data.clientIds.map((clientId) => ({ clientId })), sydneyDate());
    const results: Record<string, HealthBadgeSummary> = {};
    for (const [id, r] of map) {
      if (r.source.mode === "pending") continue;
      results[id] = { headline: r.headline, onTrack: r.onTrack, counted: r.counted, checks: r.checks.map((c) => ({ question: c.question, status: c.status, figure: c.figure })) };
    }
    return { results };
  });
