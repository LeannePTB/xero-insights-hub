// Shared access + snapshot plumbing for the reconciliation widgets.
//
// Invariants (section 0): entitlement is decided by the database
// (`client_can_use_widget`); the tenant id from the request is a FILTER
// resolved under the caller's RLS, never a grant; the service role is used
// only to persist a snapshot AFTER access has been established.

import type { WidgetKey } from "@/lib/tiers";

export type SnapshotMeta = {
  generatedAt: string | null;
  fromSnapshot: boolean;
  tenantName: string;
  canRecalculate: boolean;
  version: number;
};

export async function runReconciliation<T extends { complete: boolean }>(opts: {
  supabase: any;
  userId: string;
  clientId: string;
  tenantId: string;
  asAt: string;
  reportKey: string;
  widget: WidgetKey;
  recalculate?: boolean;
  compute: (conn: any) => Promise<T>;
}): Promise<T & SnapshotMeta> {
  const { supabase, clientId, tenantId, asAt, reportKey } = opts;

  // 1. Entitlement — the database decides, not the UI.
  const { assertClientWidget } = await import("@/lib/widget-access.server");
  await assertClientWidget(supabase, clientId, opts.widget);

  // 2. The tenant must belong to this client, resolved under the caller's RLS.
  const { data: link, error: linkErr } = await supabase
    .from("client_xero_orgs")
    .select("client_id, xero_connections!inner(tenant_id, tenant_name)")
    .eq("client_id", clientId)
    .eq("xero_connections.tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  if (linkErr) throw new Error(linkErr.message);
  if (!link) throw new Error("That Xero organisation is not linked to this client.");
  const tenantName = (link as any).xero_connections?.tenant_name ?? "Xero organisation";

  // 3. Only super admins may force a recalculation.
  const { data: superRow } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("user_id", opts.userId)
    .eq("role", "super_admin")
    .maybeSingle();
  const canRecalculate = !!superRow;
  const recalculate = !!opts.recalculate && canRecalculate;

  // 4. A complete snapshot is authoritative — the figures must not drift.
  const { reconVersion } = await import("./recon-versions");
  const currentVersion = reconVersion(reportKey);

  const { data: existing } = await supabase
    .from("reconciliation_snapshots")
    .select("payload, complete, generated_at")
    .eq("client_id", clientId)
    .eq("report_key", reportKey)
    .eq("as_at", asAt)
    .maybeSingle();

  const storedVersion = Number((existing?.payload as any)?.version ?? 0);
  const superseded = !!existing && storedVersion < currentVersion;
  if (superseded) {
    console.info(
      `[reconciliation] snapshot superseded (${reportKey} ${asAt}): stored v${storedVersion} < current v${currentVersion} — recomputing`,
    );
  }

  if (existing?.complete && !recalculate && !superseded) {
    return {
      ...(existing.payload as T),
      generatedAt: existing.generated_at,
      fromSnapshot: true,
      tenantName,
      canRecalculate,
      version: currentVersion,
    };
  }

  // 5. Compute.
  const { getConnectionByTenant } = await import("./api.server");
  const conn = await getConnectionByTenant(tenantId);
  const computed = await opts.compute(conn);
  const result = { ...computed, version: currentVersion } as T & { version: number };

  // 6. Persist. Writes need the service role (the table has no write policy);
  //    access was already established above. Never overwrite a complete
  //    snapshot with an incomplete one.
  const generatedAt = new Date().toISOString();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!existing || recalculate || superseded || (!existing.complete && result.complete)) {
      await (supabaseAdmin as any).from("reconciliation_snapshots").upsert(
        {
          client_id: clientId,
          tenant_id: tenantId,
          report_key: reportKey,
          as_at: asAt,
          payload: result,
          complete: result.complete,
          generated_by: opts.userId,
          generated_at: generatedAt,
        },
        { onConflict: "client_id,report_key,as_at" },
      );
    }
  } catch (e) {
    console.warn(`[reconciliation] snapshot write failed (${reportKey})`, e);
  }

  if (recalculate) {
    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      actorUserId: opts.userId,
      action: "reconciliation_snapshot_recalculated",
      targetType: "client",
      targetId: clientId,
      meta: { report_key: reportKey, as_at: asAt, complete: result.complete },
    });
  }

  return { ...result, generatedAt, fromSnapshot: false, tenantName, canRecalculate, version: currentVersion };
}
