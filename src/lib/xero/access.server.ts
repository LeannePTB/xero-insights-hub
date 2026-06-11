// Server-only access checks. Only import from .functions.ts handlers (dynamic import).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEFAULT_TIER_WIDGETS, type DashboardTier, type WidgetKey } from "@/lib/tiers";

export async function getEffectiveTier(
  userId: string,
  tenantId: string,
): Promise<{ isAdvisor: boolean; tier: DashboardTier | null; clientId: string | null }> {
  const { data: advisor } = await (supabaseAdmin as any).rpc("is_advisor", { _user_id: userId });

  // Resolve client_id for this tenant (first match is fine; one tenant typically maps to one client)
  const { data: cxo } = await (supabaseAdmin as any)
    .from("client_xero_orgs")
    .select("client_id, xero_connections!inner(tenant_id)")
    .eq("xero_connections.tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  const clientId = (cxo?.client_id as string | undefined) ?? null;

  if (advisor) return { isAdvisor: true, tier: "investigate", clientId };

  const { data: tier } = await (supabaseAdmin as any).rpc("get_user_tier", {
    _user_id: userId,
    _tenant_id: tenantId,
  });
  return { isAdvisor: false, tier: (tier as DashboardTier | null) ?? null, clientId };
}

export async function getClientReportBasis(tenantId: string): Promise<"accrual" | "cash"> {
  const { data: cxo } = await (supabaseAdmin as any)
    .from("client_xero_orgs")
    .select("clients!inner(report_basis), xero_connections!inner(tenant_id)")
    .eq("xero_connections.tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  const basis = cxo?.clients?.report_basis;
  return basis === "cash" ? "cash" : "accrual";
}

async function effectiveWidgets(clientId: string | null, tier: DashboardTier): Promise<WidgetKey[]> {
  if (!clientId) return DEFAULT_TIER_WIDGETS[tier];
  const { data } = await (supabaseAdmin as any).rpc("get_tier_widgets", {
    _client_id: clientId,
    _tier: tier,
  });
  const arr = (data as string[] | null) ?? [];
  if (arr.length === 0) return DEFAULT_TIER_WIDGETS[tier];
  return arr as WidgetKey[];
}

export async function assertWidgetAccess(
  userId: string,
  tenantId: string,
  widget: WidgetKey,
): Promise<void> {
  const { isAdvisor, tier, clientId } = await getEffectiveTier(userId, tenantId);
  if (!isAdvisor && !tier) throw new Error("You don't have access to this organisation.");
  // Advisors are always allowed; gating only applies to viewers.
  if (isAdvisor) return;
  const widgets = await effectiveWidgets(clientId, tier!);
  if (!widgets.includes(widget)) {
    throw new Error("This widget is not enabled for your dashboard.");
  }
}
