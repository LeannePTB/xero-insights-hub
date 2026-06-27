// Server-only access checks. Only import from .functions.ts handlers (dynamic import).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEFAULT_TIER_WIDGETS, type DashboardTier, type WidgetKey } from "@/lib/tiers";

export async function getEffectiveTier(
  userId: string,
  tenantId: string,
): Promise<{ isAdvisor: boolean; tier: DashboardTier | null; clientId: string | null }> {
  // Resolve client_id + firm_id for this tenant.
  const { data: cxo } = await (supabaseAdmin as any)
    .from("client_xero_orgs")
    .select("client_id, clients!inner(id, firm_id), xero_connections!inner(tenant_id)")
    .eq("xero_connections.tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  const clientId = (cxo?.client_id as string | undefined) ?? null;
  const firmId = (cxo?.clients?.firm_id as string | undefined) ?? null;

  // Subscription-scoped access only:
  //  - firm members (any role) see the firm's clients with full "investigate" tier
  //  - users with an explicit client_access row see at their granted tier
  //  - everyone else (global advisor, super_admin, etc.) is denied
  if (firmId) {
    const { data: member } = await (supabaseAdmin as any)
      .from("firm_members")
      .select("user_id")
      .eq("user_id", userId)
      .eq("firm_id", firmId)
      .maybeSingle();
    if (member) return { isAdvisor: true, tier: "investigate", clientId };
  }

  if (clientId) {
    const { data: tierRows } = await (supabaseAdmin as any)
      .from("client_access")
      .select("tier")
      .eq("user_id", userId)
      .eq("client_id", clientId);
    const rank: Record<string, number> = { investigate: 3, advisory: 2 };
    let tier: DashboardTier | null = null;
    let best = -1;
    for (const r of (tierRows as Array<{ tier: DashboardTier }> | null) ?? []) {
      const score = rank[r.tier] ?? 1;
      if (score > best) { best = score; tier = r.tier; }
    }
    return { isAdvisor: false, tier, clientId };
  }

  return { isAdvisor: false, tier: null, clientId };
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
  // get_tier_widgets: client-specific row, else default row, else DEFAULT_TIER_WIDGETS.
  const { data: specific } = await (supabaseAdmin as any)
    .from("tier_widget_config")
    .select("widgets")
    .eq("client_id", clientId)
    .eq("tier", tier)
    .maybeSingle();
  let arr: string[] = (specific?.widgets as string[] | undefined) ?? [];
  if (arr.length === 0) {
    const { data: fallback } = await (supabaseAdmin as any)
      .from("tier_widget_config")
      .select("widgets")
      .is("client_id", null)
      .eq("tier", tier)
      .maybeSingle();
    arr = (fallback?.widgets as string[] | undefined) ?? [];
  }
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
