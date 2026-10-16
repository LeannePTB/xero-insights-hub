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
    // The client's own "How often this client lodges" setting, read under the
    // caller's session. "Does not withhold" means the engine does not look
    // for PAYG at all — no account hunt, no pay-run read, no issue line.
    const { data: clientRow, error: clientError } = await (context.supabase as any)
      .from("clients")
      .select("gst_cycle, basis_overrides")
      .eq("id", data.clientId)
      .maybeSingle();
    if (clientError) throw new Error(clientError.message);
    if (!clientRow?.gst_cycle || clientRow.gst_cycle === "not_registered") {
      throw new Error(
        clientRow?.gst_cycle === "not_registered"
          ? "This client is not registered for GST."
          : "Set this client's GST lodgement cycle before loading GST figures.",
      );
    }
    // PAYG belongs on the PAYG card: this card reads GST inputs only, so its
    // completeness never depends on pay runs.
    const gstOverride = (clientRow?.basis_overrides as Record<string, unknown> | null)?.gst_method ?? null;
    const run = (recalculate?: boolean) => runReconciliation({
      supabase: context.supabase as any,
      userId: context.userId,
      clientId: data.clientId,
      tenantId: data.tenantId,
      asAt: data.asAt,
      recalculate,
      reportKey: REPORT_KEYS[data.window ?? "month"]!,
      widget: "gst_reconciliation",
      compute: async (conn) => {
        const { xeroGet } = await import("./api.server");
        const { resolveGstMethod } = await import("./gst-activity");
        let raw: string | null = null;
        try {
          const org = await xeroGet<{ Organisations?: { SalesTaxBasis?: string }[] }>(conn, "Organisation", {});
          raw = org.Organisations?.[0]?.SalesTaxBasis ?? null;
        } catch { raw = null; }
        const method = resolveGstMethod(gstOverride, raw);
        return computeGstReconciliation(
          conn,
          data.asAt,
          data.window ?? "month",
          overrides,
          context.supabase,
          false,
          data.clientId,
          method,
        );
      },
    });
    const first = await run(data.recalculate);
    // A saved calculation made under a different method (the adviser changed
    // the setting since) is never served: recalculate once.
    const savedOverride = first.method?.source === "override" ? first.method.method : null;
    if (!data.recalculate && (gstOverride ?? null) !== savedOverride && (gstOverride || first.method?.source === "override")) return run(true);
    return first;
  });
