import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";
import type { GstResult } from "./gst.server";
import type { SnapshotMeta } from "./recon-snapshot.server";

export const GST_REPORT_KEY = "gst_reconciliation";
/** A monthly and a quarterly window can share an as-at date (30 September is
 *  both), and the snapshot key is (client_id, report_key, as_at). Quarterly
 *  windows therefore get their OWN report key, so a stored monthly payload can
 *  never be re-served as a quarter. */
export const GST_QUARTER_REPORT_KEY = "gst_reconciliation_quarter";
/** The financial-year window shares its as-at date with the monthly and
 *  quarterly "to date" windows (all end today), so it needs its own key for
 *  the same reason the quarter does. */
export const GST_YEAR_REPORT_KEY = "gst_reconciliation_year";

export type GstResponse = GstResult & SnapshotMeta;

type Input = {
  clientId: string;
  tenantId: string;
  asAt: string;
  window?: "month" | "quarter" | "year";
  recalculate?: boolean;
};

const REPORT_KEYS: Record<string, string> = {
  month: GST_REPORT_KEY,
  quarter: GST_QUARTER_REPORT_KEY,
  year: GST_YEAR_REPORT_KEY,
};

function validate(i: Input): Input {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.asAt)) throw new Error("Invalid period end date.");
  const window = i.window ?? "month";
  if (!REPORT_KEYS[window]) throw new Error("Invalid period type.");
  return { ...i, window };
}

export const getGstReconciliation = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<GstResponse> => {
    const { runReconciliation } = await import("./recon-snapshot.server");
    const { computeGstReconciliation } = await import("./gst.server");
    const { getStatutoryOverrides } = await import("./statutory-overrides.server");
    // The per-client statutory mapping, read under the caller's own session.
    // It feeds the ONE resolver inside the engine — the report, the health
    // rules and the audit rules all classify accounts the same way.
    const overrides = await getStatutoryOverrides(context.supabase as any, data.clientId, data.tenantId);
    return runReconciliation({
      supabase: context.supabase as any,
      userId: context.userId,
      clientId: data.clientId,
      tenantId: data.tenantId,
      asAt: data.asAt,
      recalculate: data.recalculate,
      reportKey: REPORT_KEYS[data.window ?? "month"]!,
      widget: "gst_reconciliation",
      compute: (conn) =>
        computeGstReconciliation(conn, data.asAt, data.window ?? "month", overrides, context.supabase),

    });
  });
