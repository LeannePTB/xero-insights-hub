// The client overview: an organisation team's landing page. Members only.
//
// Zero Xero calls: stored snapshots only. The client list comes from the
// caller-scoped `overview_clients()` (active membership AND client read access; optional organisation filter);
// every snapshot read runs as the caller through `context.supabase`, so RLS
// applies. Status is the existing `evaluateClient`, never a second engine.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

export type FeedEvent = import("./feed.server").FeedEvent;

const Input = z.object({ firmId: z.string().uuid().optional() }).strict().optional();

export type OverviewRow = {
  clientId: string;
  clientName: string;
  firmId: string;
  firmName: string;
  verdict: import("@/lib/health/rules.server").Verdict;
  rank: number;
  bucket: import("./changes").OverviewBucket;
  cash: number | null;
  /** Credit card debt owed (positive number), from the Balance Sheet. */
  creditCardDebt: number | null;
  /** Cash at bank less credit card debt — the cash actually available. */
  netCash: number | null;
  cashChange7d: number | null;
  cashBigMove: boolean;
  /** Protected money as a share of cash at bank (shared rule); null when no cash at bank. */
  protectedMoney?: number | null;
  /** What is due next to the ATO (lodged bill, else the building period). */
  taxNext: { amount: number; due: string; overdue: boolean } | null;
  /** Running period's GST + PAYG, shown when a lodged bill leads. */
  taxBuilding: { amount: number; due: string } | null;
  superDue: { amount: number; due: string | null } | null;
  taxItems: { label: string; amount: number; due: string | null; overdue: boolean }[];
  netProfitMtd: number | null;
  /** Late share of recent invoices (due ≤ 90 days ago or not yet due), as %. */
  debtorsOverduePct: number | null;
  /** Debts more than 90 days past due — neutral, never an alert. */
  debtorsOldAmount?: number | null;
  /** Receivables more than 60 days past due (stored snapshot); null when unknown. */
  debtorsOver60?: number | null;
  /** A linked Xero file is not connected. */
  xeroNeedsAttention?: boolean;
  lastReportSentAt: string | null;
  freshAsAt: string | null;
  /** Presentation only: caller may manage (and so re-sync) this client. Server re-checks. */
  canResync: boolean;
  /** Oldest per-account reconciled-to date across in-scope bank accounts (nightly key figures). */
  bankReconciledTo: string | null;
  /** Named stale-account warning; null when fine or when data is missing/unclear. */
  bankReconWarning: string | null;
  cashNote: string | null;
  /** Most recent Xero sign-in by anyone in the file (Finance API), from the nightly key figures. */
  lastXeroLoginAt: string | null;
  historyNote: string | null;
  /** Up to 30 daily cash figures from the nightly key figures, oldest first. */
  cashSpark: number[];
};

export const getClientOverview = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ rows: OverviewRow[]; feed: FeedEvent[]; cleared: FeedEvent[]; feedNotes: string[]}> => {
    try {
      const { buildOverview } = await import("./overview.server");
      // firmId is a FILTER inside overview_clients(); access stays caller-scoped.
      return await buildOverview(context.supabase as any, context.userId as string, data?.firmId ?? null);
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
