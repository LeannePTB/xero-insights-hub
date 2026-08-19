import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FixedAssetsResult } from "./fixed-assets.server";
import type { SnapshotMeta } from "./recon-snapshot.server";

export const FIXED_ASSETS_REPORT_KEY = "fixed_assets_reconciliation";

export type FixedAssetsResponse = FixedAssetsResult & SnapshotMeta;

type Input = { clientId: string; tenantId: string; asAt: string; recalculate?: boolean };

function validate(i: Input): Input {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.asAt)) throw new Error("Invalid period end date.");
  return i;
}

export const getFixedAssetsReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<FixedAssetsResponse> => {
    const { runReconciliation } = await import("./recon-snapshot.server");
    const { computeFixedAssetsReconciliation } = await import("./fixed-assets.server");
    return runReconciliation({
      supabase: context.supabase as any,
      userId: context.userId,
      clientId: data.clientId,
      tenantId: data.tenantId,
      asAt: data.asAt,
      recalculate: data.recalculate,
      reportKey: FIXED_ASSETS_REPORT_KEY,
      widget: "fixed_assets_reconciliation",
      compute: (conn) => computeFixedAssetsReconciliation(conn, data.asAt),
    });
  });
