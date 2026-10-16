import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

/**
 * Break-even default dates (owner decision, 16 Oct 2026): FROM 1 July of the
 * current financial year, TO the as-at date of the latest SAVED figures for
 * this Xero file. Reads the stored year-to-date profit and loss parameters
 * only — never calls Xero — so the default range hits the saved copy exactly.
 *
 * Stored-only and caller-scoped: authorised as the Break-Even card for this
 * caller, and the row is read through RLS as the caller. Returns dates only.
 */
export const getBreakevenDefaultRange = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ tenantId: z.string().min(1).max(100) }).parse(i))
  .handler(async ({ data, context }): Promise<{ fromDate: string; toDate: string } | null> => {
    const { assertWidgetAccess } = await import("./access.server");
    await assertWidgetAccess(context.supabase, data.tenantId, "accounting_breakeven");
    const { data: row, error } = await (context.supabase as any)
      .from("xero_snapshots")
      .select("params")
      .eq("tenant_id", data.tenantId)
      .eq("report_key", "profit_and_loss_ytd")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !row) return null;
    const from = row.params?.fromDate;
    const to = row.params?.toDate;
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (typeof from !== "string" || typeof to !== "string" || !iso.test(from) || !iso.test(to)) return null;
    return { fromDate: from, toDate: to };
  });
