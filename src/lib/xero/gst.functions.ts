import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GstResult } from "./gst.server";
import type { SnapshotMeta } from "./recon-snapshot.server";

export const GST_REPORT_KEY = "gst_reconciliation";

export type GstResponse = GstResult & SnapshotMeta;

type Input = { clientId: string; tenantId: string; asAt: string; recalculate?: boolean };

function validate(i: Input): Input {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.asAt)) throw new Error("Invalid period end date.");
  return i;
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
      reportKey: GST_REPORT_KEY,
      widget: "gst_reconciliation",
      compute: (conn) => computeGstReconciliation(conn, data.asAt),
    });
  });
