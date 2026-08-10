import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Dashboard tier keys the organisation's plan includes.
 * `null` means unrestricted (unknown plan, or a plan with no list set).
 */
export async function allowedTiersForFirm(firmId: string | null | undefined): Promise<string[] | null> {
  if (!firmId) return null;
  const { data: sub } = await (supabaseAdmin as any)
    .from("subscriptions")
    .select("tier")
    .eq("firm_id", firmId)
    .maybeSingle();
  const tier = sub?.tier as string | undefined;
  if (!tier) return null;
  const { data: level } = await (supabaseAdmin as any)
    .from("plan_levels")
    .select("allowed_tiers")
    .eq("scope", "firm")
    .eq("key", tier)
    .maybeSingle();
  const allowed = (level?.allowed_tiers ?? []) as string[];
  return allowed.length ? allowed : null;
}

export async function allowedTiersForClient(clientId: string): Promise<string[] | null> {
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("firm_id")
    .eq("id", clientId)
    .maybeSingle();
  return allowedTiersForFirm(client?.firm_id ?? null);
}

async function isSuperAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  return Boolean(data);
}

/** Throws unless the tier is in the organisation's plan (super admins may override). */
export async function assertTierInPlanForClient(userId: string, clientId: string, tier: string) {
  const allowed = await allowedTiersForClient(clientId);
  if (!allowed || allowed.includes(tier)) return;
  if (await isSuperAdmin(userId)) return;
  throw new Error("That dashboard tier isn't included in this organisation's plan.");
}
