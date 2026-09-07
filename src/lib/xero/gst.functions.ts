import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GstResult } from "./gst.server";
import type { SnapshotMeta } from "./recon-snapshot.server";

export const GST_REPORT_KEY = "gst_reconciliation";
/** A monthly and a quarterly window can share an as-at date (30 September is
 *  both), and the snapshot key is (client_id, report_key, as_at). Quarterly
 *  windows therefore get their OWN report key, so a stored monthly payload can
 *  never be re-served as a quarter. */
export const GST_QUARTER_REPORT_KEY = "gst_reconciliation_quarter";

export type GstResponse = GstResult & SnapshotMeta;

type Input = {
  clientId: string;
  tenantId: string;
  asAt: string;
  window?: "month" | "quarter";
  recalculate?: boolean;
};

function validate(i: Input): Input {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.asAt)) throw new Error("Invalid period end date.");
  const window = i.window ?? "month";
  if (window !== "month" && window !== "quarter") throw new Error("Invalid period type.");
  return { ...i, window };
}

export const getGstReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<GstResponse> => {
    const { runReconciliation } = await import("./recon-snapshot.server");
    const { computeGstReconciliation } = await import("./gst.server");
    return runReconciliation({
      supabase: context.supabase as any,
      userId: context.userId,
      clientId: data.clientId,
      tenantId: data.tenantId,
      asAt: data.asAt,
      recalculate: data.recalculate,
      reportKey: data.window === "quarter" ? GST_QUARTER_REPORT_KEY : GST_REPORT_KEY,
      widget: "gst_reconciliation",
      compute: (conn) => computeGstReconciliation(conn, data.asAt, data.window ?? "month"),
    });
  });
