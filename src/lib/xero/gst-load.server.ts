import type { GstInput, GstResponse } from "./gst.functions";
import { GST_REPORT_KEYS } from "./gst.functions";

/** The GST card's loader, shared by the card's server function and Trixie.
 *  Behaviour unchanged: card gate, tenant link and saved-calculation reuse all
 *  live in runReconciliation. */
export async function loadGstReconciliation(supabase: any, userId: string, data: GstInput): Promise<GstResponse> {
    const { runReconciliation } = await import("./recon-snapshot.server");
    const { computeGstReconciliation } = await import("./gst.server");
    const { getStatutoryOverrides } = await import("./statutory-overrides.server");
    // The per-client statutory mapping, read under the caller's own session.
    // It feeds the ONE resolver inside the engine — the report, the health
    // rules and the audit rules all classify accounts the same way.
    const overrides = await getStatutoryOverrides(supabase, data.clientId, data.tenantId);
    // The client's own "How often this client lodges" setting, read under the
    // caller's session. "Does not withhold" means the engine does not look
    // for PAYG at all — no account hunt, no pay-run read, no issue line.
    const { data: clientRow, error: clientError } = await (supabase)
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
      supabase: supabase,
      userId: userId,
      clientId: data.clientId,
      tenantId: data.tenantId,
      asAt: data.asAt,
      recalculate,
      reportKey: GST_REPORT_KEYS[data.window ?? "month"]!,
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
          supabase,
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
}
