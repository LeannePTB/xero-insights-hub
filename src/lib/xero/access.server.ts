// Server-only access checks. Only import from .functions.ts handlers (dynamic import).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { DashboardTier, WidgetKey } from "@/lib/tiers";
import { canAccessWidget } from "@/lib/tiers";

export async function getEffectiveTier(
  userId: string,
  tenantId: string,
): Promise<{ isAdvisor: boolean; tier: DashboardTier | null }> {
  const { data: advisor } = await (supabaseAdmin as any).rpc("is_advisor", { _user_id: userId });
  if (advisor) return { isAdvisor: true, tier: "investigate" };
  const { data: tier } = await (supabaseAdmin as any).rpc("get_user_tier", {
    _user_id: userId,
    _tenant_id: tenantId,
  });
  return { isAdvisor: false, tier: (tier as DashboardTier | null) ?? null };
}

export async function assertWidgetAccess(
  userId: string,
  tenantId: string,
  widget: WidgetKey,
): Promise<void> {
  const { isAdvisor, tier } = await getEffectiveTier(userId, tenantId);
  if (isAdvisor) return;
  if (!tier) throw new Error("You don't have access to this organisation.");
  if (!canAccessWidget(tier, widget)) {
    throw new Error("Your dashboard tier doesn't include this widget.");
  }
}
