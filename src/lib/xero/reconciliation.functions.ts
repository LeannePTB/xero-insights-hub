import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const RECON_REPORT_KEY = "balance_sheet_reconciliation";

export type ReconciliationPayload = {
  asAt: string;
  rows: {
    key: string;
    label: string;
    kind: "receivables" | "payables" | "bank";
    glBalance: number | null;
    subledgerBalance: number | null;
    variance: number | null;
    status: "balanced" | "variance" | "unavailable";
    reason?: string;
  }[];
  unreconciled: { label: string; detail: string; amount?: number }[];
  complete: boolean;
  issues: string[];
};

export type ReconciliationResponse = ReconciliationPayload & {
  generatedAt: string | null;
  fromSnapshot: boolean;
  tenantName: string;
  canRecalculate: boolean;
};

type Input = { clientId: string; tenantId: string; asAt: string; recalculate?: boolean };

function validate(i: Input): Input {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.asAt)) throw new Error("Invalid period end date.");
  return i;
}

export const getBalanceSheetReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<ReconciliationResponse> => {
    const supabase = context.supabase as any;

    // 1. Entitlement — the database decides, not the UI.
    const { assertClientWidget } = await import("@/lib/widget-access.server");
    await assertClientWidget(supabase, data.clientId, RECON_REPORT_KEY as any);

    // 2. The tenant must belong to this client, resolved under the caller's RLS.
    //    A tenant id from the request is a filter, never a grant.
    const { data: link, error: linkErr } = await supabase
      .from("client_xero_orgs")
      .select("client_id, xero_connections!inner(tenant_id, tenant_name)")
      .eq("client_id", data.clientId)
      .eq("xero_connections.tenant_id", data.tenantId)
      .limit(1)
      .maybeSingle();
    if (linkErr) throw new Error(linkErr.message);
    if (!link) throw new Error("That Xero organisation is not linked to this client.");
    const tenantName = (link as any).xero_connections?.tenant_name ?? "Xero organisation";

    // 3. Super admin? Only they may force a recalculation.
    const { data: superRow } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("user_id", context.userId)
      .eq("role", "super_admin")
      .maybeSingle();
    const canRecalculate = !!superRow;
    const recalculate = !!data.recalculate && canRecalculate;

    // 4. A complete snapshot is authoritative — the figures must not drift.
    const { data: existing } = await supabase
      .from("reconciliation_snapshots")
      .select("payload, complete, generated_at")
      .eq("client_id", data.clientId)
      .eq("report_key", RECON_REPORT_KEY)
      .eq("as_at", data.asAt)
      .maybeSingle();

    if (existing?.complete && !recalculate) {
      return {
        ...(existing.payload as ReconciliationPayload),
        generatedAt: existing.generated_at,
        fromSnapshot: true,
        tenantName,
        canRecalculate,
      };
    }

    // 5. Compute.
    const { getConnectionByTenant } = await import("./api.server");
    const { computeBalanceSheetReconciliation } = await import("./reconciliation.server");
    const conn = await getConnectionByTenant(data.tenantId);
    const result = await computeBalanceSheetReconciliation(conn, data.asAt);

    // 6. Persist. Writes need the service role (the table has no write policy);
    //    access was already established above. Never overwrite a complete
    //    snapshot with an incomplete one.
    const generatedAt = new Date().toISOString();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      if (!existing || recalculate || (!existing.complete && result.complete)) {
        await (supabaseAdmin as any)
          .from("reconciliation_snapshots")
          .upsert(
            {
              client_id: data.clientId,
              tenant_id: data.tenantId,
              report_key: RECON_REPORT_KEY,
              as_at: data.asAt,
              payload: result,
              complete: result.complete,
              generated_by: context.userId,
              generated_at: generatedAt,
            },
            { onConflict: "client_id,report_key,as_at" },
          );
      }
    } catch (e) {
      console.warn("[reconciliation] snapshot write failed", e);
    }

    if (recalculate) {
      const { writeAudit } = await import("@/lib/audit.server");
      await writeAudit({
        actorUserId: context.userId,
        action: "reconciliation_snapshot_recalculated",
        targetType: "client",
        targetId: data.clientId,
        meta: { report_key: RECON_REPORT_KEY, as_at: data.asAt, complete: result.complete },
      });
    }

    return {
      ...result,
      generatedAt,
      fromSnapshot: false,
      tenantName,
      canRecalculate,
    };
  });
