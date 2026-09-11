// Server-only. THE Xero dashboard read gate — every card inherits it.
//
// Phase 4 (one rulebook): this file no longer decides anything. The rule has a
// single implementation and it lives in the database:
//   public.effective_tier_for_tenant(_tenant_id) — is the caller organisation
//     staff for this Xero file, or a client viewer, and at what level
//   public.assert_widget_access(_tenant_id, _widget) — access + entitlement
//   public.client_for_tenant(_tenant_id) — the client that owns the file,
//     resolved deterministically (it raises rather than guessing if a file were
//     ever linked to two clients)
// All three are caller-scoped (auth.uid()), aal2-guarded, and read through the
// caller's own session — never supabaseAdmin. Never reimplement them here.

import type { DashboardTier, WidgetKey } from "@/lib/tiers";

export async function getEffectiveTier(
  supabase: any,
  tenantId: string,
): Promise<{ isAdvisor: boolean; tier: DashboardTier | null; clientId: string | null }> {
  const { data, error } = await supabase.rpc("effective_tier_for_tenant", {
    _tenant_id: tenantId,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    isAdvisor: row?.is_staff === true,
    tier: ((row?.tier as DashboardTier | null) ?? null) as DashboardTier | null,
    clientId: (row?.client_id as string | null) ?? null,
  };
}

/**
 * Reporting basis for the Xero file's client. Not an access decision — callers
 * run `assertWidgetAccess` first — so it reads with the service role to stay
 * independent of the caller's own visibility.
 */
export async function getClientReportBasis(tenantId: string): Promise<"accrual" | "cash"> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cxo } = await (supabaseAdmin as any)
    .from("client_xero_orgs")
    .select("clients!inner(report_basis), xero_connections!inner(tenant_id)")
    .eq("xero_connections.tenant_id", tenantId)
    .maybeSingle();
  const basis = cxo?.clients?.report_basis;
  return basis === "cash" ? "cash" : "accrual";
}

/** The one gate. Throws with the database's message when access is refused. */
export async function assertWidgetAccess(
  supabase: any,
  tenantId: string,
  widget: WidgetKey,
): Promise<void> {
  const { error } = await supabase.rpc("assert_widget_access", {
    _tenant_id: tenantId,
    _widget: widget,
  });
  if (error) throw new Error(error.message);
}
