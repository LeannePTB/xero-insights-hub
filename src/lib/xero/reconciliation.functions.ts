import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ReconResult } from "./reconciliation.server";
import type { SnapshotMeta } from "./recon-snapshot.server";

export const RECON_REPORT_KEY = "balance_sheet_reconciliation";

export type ReconciliationPayload = ReconResult;
export type ReconciliationResponse = ReconResult & SnapshotMeta;

type Input = { clientId: string; tenantId: string; asAt: string; recalculate?: boolean };

function validate(i: Input): Input {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.asAt)) throw new Error("Invalid period end date.");
  return i;
}

export const getBalanceSheetReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<ReconciliationResponse> => {
    const { runReconciliation } = await import("./recon-snapshot.server");
    const { computeBalanceSheetReconciliation } = await import("./reconciliation.server");
    return runReconciliation({
      supabase: context.supabase as any,
      userId: context.userId,
      clientId: data.clientId,
      tenantId: data.tenantId,
      asAt: data.asAt,
      recalculate: data.recalculate,
      reportKey: RECON_REPORT_KEY,
      widget: "balance_sheet_reconciliation",
      compute: (conn) => computeBalanceSheetReconciliation(conn, data.asAt),
    });
  });
