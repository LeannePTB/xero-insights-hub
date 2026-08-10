import type { PlanLevel } from "@/lib/plan-levels.functions";

/**
 * Dashboard tiers an organisation plan may hand out to its clients.
 * An empty list on the plan means "everything" so older data keeps working.
 */
export function tiersForPlan(
  levels: Array<Pick<PlanLevel, "scope" | "key" | "allowed_tiers">>,
  firmTierKey: string | null | undefined,
): string[] | null {
  if (!firmTierKey) return null; // unknown plan → don't restrict
  const plan = levels.find((l) => l.scope === "firm" && l.key === firmTierKey);
  if (!plan) return null;
  const allowed = plan.allowed_tiers ?? [];
  return allowed.length ? allowed : null;
}

/** True when the tier is permitted by the plan (null = unrestricted). */
export function tierAllowed(allowed: string[] | null, tier: string): boolean {
  return !allowed || allowed.includes(tier);
}
