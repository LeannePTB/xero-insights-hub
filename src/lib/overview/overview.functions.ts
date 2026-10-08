// The client overview (practice-team landing page). Staff-only.
//
// Zero Xero calls: stored snapshots only. The client list comes from the
// caller-scoped `overview_clients()` (practice team AND active membership);
// every snapshot read runs as the caller through `context.supabase`, so RLS
// applies. Status is the existing `evaluateClient`, never a second engine.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

export type FeedEvent = import("./feed.server").FeedEvent;

const Input = z.object({}).strict().optional();

export type OverviewRow = {
  clientId: string;
  clientName: string;
  firmId: string;
  firmName: string;
  verdict: import("@/lib/health/rules.server").Verdict;
  rank: number;
  bucket: import("./changes").OverviewBucket;
  cash: number | null;
  cashChange7d: number | null;
  cashBigMove: boolean;
  protectedPctOfCash: number | null;
  netProfitMtd: number | null;
  debtorsOverduePct: number | null;
  lastReportSentAt: string | null;
  freshAsAt: string | null;
  /** Date of the newest reconciled bank transaction, from the nightly key figures. */
  bankReconciledTo: string | null;
  historyNote: string | null;
  /** Up to 30 daily cash figures from the nightly key figures, oldest first. */
  cashSpark: number[];
};

export const getClientOverview = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(
    async ({
      context,
    }): Promise<{ rows: OverviewRow[]; feed: FeedEvent[]; cleared: FeedEvent[]; feedNotes: string[] }> => {
    try {
      const { buildOverview } = await import("./overview.server");
      return await buildOverview(context.supabase as any, context.userId as string);
    } catch (e) {
      console.error("[overview] failed", e instanceof Error ? e.message : e);
      throw new Error("The client overview could not be loaded.");
    }
  },
  );

const AlertInput = z.object({
  clientId: z.string().uuid(),
  eventKey: z.string().min(1).max(120).regex(/^[a-z0-9_:.-]+$/i),
  action: z.enum(["acknowledge", "snooze", "clear"]),
  severity: z.number().int().min(0).max(4),
  snoozeDays: z.number().int().min(1).max(90).optional(),
});

/**
 * Shared acknowledge / snooze / un-acknowledge. Authorisation is entirely in
 * the database (aal2 + user_can_write_client, audited); the caller-supplied
 * client id is a filter the function re-checks, never a grant.
 */
export const setOverviewAlert = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => AlertInput.parse(i))
  .handler(async ({ data, context }) => {
    const until =
      data.action === "snooze"
        ? new Date(Date.now() + (data.snoozeDays ?? 7) * 86_400_000).toISOString()
        : null;
    const { error } = await (context.supabase as any).rpc("set_overview_alert_state", {
      _client_id: data.clientId,
      _event_key: data.eventKey,
      _action: data.action,
      _severity: data.severity,
      _snooze_until: until,
    });
    if (error) {
      console.warn("[overview] alert state refused", error.message);
      throw new Error("That alert could not be updated.");
    }
    return { ok: true };
  });
