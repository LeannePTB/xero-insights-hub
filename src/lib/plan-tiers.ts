import type { PlanLevel } from "@/lib/plan-levels.functions";
import { ALL_TIERS, type DashboardTier } from "@/lib/tiers";

/**
 * Plan data can carry dashboard tier keys that no longer exist (the "free"
 * organisation plan still lists `pt`, which is not a `dashboard_tier` value).
 * Anything unknown is dropped rather than allowed to reach the database.
 */
export function knownDashboardTiers(keys: readonly string[] | null | undefined): DashboardTier[] {
  const valid = new Set<string>(ALL_TIERS as readonly string[]);
  return (keys ?? []).filter((k): k is DashboardTier => valid.has(k));
}

export function isDashboardTier(key: string | null | undefined): key is DashboardTier {
  return !!key && (ALL_TIERS as readonly string[]).includes(key);
}

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

/**
 * Dashboard tiers a plan's clients can actually use — cumulative.
 * A plan that grants a higher tier also grants everything ranked below it,
 * so its clients can see every card up to and including that tier.
 */
export function cumulativeDashboardLevels<
  T extends { key: string; sort_order?: number | null },
>(levels: T[], allowedTiers: string[] | null): T[] {
  if (!allowedTiers || allowedTiers.length === 0) return levels;
  const granted = levels.filter((l) => allowedTiers.includes(l.key));
  if (granted.length === 0) return [];
  const ceiling = Math.max(...granted.map((l) => l.sort_order ?? 0));
  return levels.filter((l) => (l.sort_order ?? 0) <= ceiling);
}

