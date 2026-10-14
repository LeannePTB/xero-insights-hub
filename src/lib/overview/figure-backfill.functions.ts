import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

/**
 * One-off month-end history backfill trigger and progress (System Admin → Xero).
 * Authorisation is entirely in the database: start_figure_backfill() and
 * figure_backfill_status() call assert_super_admin() (aal2 + role). No admin
 * client here; the work itself runs in the registered scheduled job.
 */
export const startFigureBackfill = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((d: unknown) => z.object({ firmId: z.string().uuid().nullable().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { data: runId, error } = await (context.supabase as any).rpc("start_figure_backfill", { _firm_id: data.firmId ?? null });
    if (error) {
      if (/ALREADY_RUNNING/.test(error.message)) throw new Error("A history fill is already running.");
      throw new Error(/forbidden/i.test(error.message) ? "Forbidden" : "The history fill could not be started.");
    }
    return { runId: runId as string };
  });

export type BackfillStatusRow = {
  organisation: string | null; client: string | null; file: string | null; status: string | null;
  monthsCash: number; monthsProfit: number; reason: string | null;
};

export const getFigureBackfillStatus = createServerFn({ method: "GET" })
  .middleware([requireAal2])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).rpc("figure_backfill_status");
    if (error) throw new Error("Progress unavailable");
    const rows = (data ?? []) as any[];
    const first = rows[0];
    return {
      run: first ? { status: first.run_status as string, requestedAt: first.requested_at as string, finishedAt: (first.finished_at as string | null) ?? null } : null,
      items: rows.filter((r) => r.client).map((r): BackfillStatusRow => ({
        organisation: r.organisation, client: r.client, file: r.file, status: r.status,
        monthsCash: r.months_cash ?? 0, monthsProfit: r.months_profit ?? 0, reason: r.reason,
      })),
    };
  });
