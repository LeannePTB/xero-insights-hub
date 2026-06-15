import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TIER_LIMITS: Record<string, number> = {
  starter: 5,
  growth: 10,
  scale: 20,
  firm: 50,
  legacy: 9999,
};

export type FirmAccessState =
  | { state: "no_firm" }
  | {
      state: "ok" | "trial" | "locked";
      firmId: string;
      firmName: string;
      isAlwaysFree: boolean;
      tier: string | null;
      status: string | null;
      trialEndsAt: string | null;
      currentPeriodEnd: string | null;
      trialDaysLeft: number | null;
      connectionCount: number;
      connectionLimit: number;
      reason?: string;
    };

/**
 * Plain helper so other server fns can reuse the access check without
 * going through the createServerFn RPC boundary.
 */
export async function computeFirmAccess(userId: string): Promise<FirmAccessState> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: membership } = await (supabaseAdmin as any)
    .from("firm_members")
    .select("firm_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.firm_id) return { state: "no_firm" };
  const firmId = membership.firm_id as string;

  const { data: firm } = await (supabaseAdmin as any)
    .from("firms").select("id, name, is_always_free").eq("id", firmId).maybeSingle();
  if (!firm) return { state: "no_firm" };

  const { data: sub } = await (supabaseAdmin as any)
    .from("subscriptions")
    .select("tier, status, trial_ends_at, current_period_end")
    .eq("firm_id", firmId)
    .maybeSingle();

  const { count } = await (supabaseAdmin as any)
    .from("xero_connections").select("id", { count: "exact", head: true }).eq("firm_id", firmId);

  const tier = sub?.tier ?? null;
  const limit = tier ? TIER_LIMITS[tier] ?? 5 : 5;
  const connectionCount = count ?? 0;

  const base = {
    firmId, firmName: firm.name as string,
    isAlwaysFree: !!firm.is_always_free,
    tier, status: sub?.status ?? null,
    trialEndsAt: sub?.trial_ends_at ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
    connectionCount, connectionLimit: limit,
  };

  if (firm.is_always_free) {
    return { ...base, state: "ok", trialDaysLeft: null };
  }

  const status: string | null = sub?.status ?? null;
  const now = Date.now();

  if (status === "trialing" && sub?.trial_ends_at) {
    const ends = new Date(sub.trial_ends_at).getTime();
    const daysLeft = Math.ceil((ends - now) / (24 * 60 * 60 * 1000));
    if (ends < now) {
      return { ...base, state: "locked", trialDaysLeft: 0, reason: "trial_expired" };
    }
    return { ...base, state: "trial", trialDaysLeft: Math.max(0, daysLeft) };
  }

  if (status === "active") return { ...base, state: "ok", trialDaysLeft: null };

  if (status === "past_due" || status === "canceled" || status === "paused" || !status) {
    return { ...base, state: "locked", trialDaysLeft: null, reason: status ?? "no_subscription" };
  }

  return { ...base, state: "ok", trialDaysLeft: null };
}

/**
 * Returns the access posture for the current user's firm.
 * Used by the dashboard to render trial banners or a lock screen.
 */
export const getMyFirmAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FirmAccessState> => {
    return computeFirmAccess(context.userId);
  });
