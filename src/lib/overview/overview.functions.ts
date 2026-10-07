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
    }): Promise<{ rows: OverviewRow[]; feed: FeedEvent[]; feedNotes: string[] }> => {
    try {
      const { buildOverview } = await import("./overview.server");
      return await buildOverview(context.supabase as any, context.userId as string);
    } catch (e) {
      console.error("[overview] failed", e instanceof Error ? e.message : e);
      throw new Error("The client overview could not be loaded.");
    }
  },
  );
