// Firm subscription plan constants shared across server + client.
// Client quotas per tier. `legacy` = no limit (pre-billing firms).
export const CLIENT_LIMITS = {
  starter: 5,
  growth: 10,
  scale: 20,
  firm: 50,
  free: 9999,
  legacy: 9999,
} as const;

export type FirmTier = keyof typeof CLIENT_LIMITS;

export const TIER_LABEL: Record<FirmTier, string> = {
  starter: "Starter (5 clients)",
  growth: "Growth (10 clients)",
  scale: "Scale (20 clients)",
  firm: "Firm (50 clients)",
  free: "Free forever",
  legacy: "Legacy",
};

export const TIER_SHORT: Record<FirmTier, string> = {
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
  firm: "Firm",
  free: "Free",
  legacy: "Legacy",
};

// Stripe price lookup_keys — created via the payments--batch_create_product tool.
export const TIER_PRICE_KEY: Record<Exclude<FirmTier, "free" | "legacy">, string> = {
  starter: "traction_starter_monthly",
  growth: "traction_growth_monthly",
  scale: "traction_scale_monthly",
  firm: "traction_firm_monthly",
};

export function clientLimitFor(
  tier: string | null | undefined,
  isAlwaysFree?: boolean | null,
  opts?: { override?: number | null; catalogue?: Record<string, number> | null },
): number {
  // A per-organisation override always wins, so support can hand out extra seats.
  if (opts?.override != null && Number.isFinite(opts.override)) return Math.max(0, opts.override);
  if (isAlwaysFree) return CLIENT_LIMITS.free;
  const t = (tier ?? "legacy") as FirmTier;
  const fromCatalogue = tier ? opts?.catalogue?.[tier] : undefined;
  if (fromCatalogue != null) return fromCatalogue;
  return CLIENT_LIMITS[t] ?? CLIENT_LIMITS.legacy;
}

/** Maps the `plan_levels` rows for scope `firm` into a key -> client limit lookup. */
export function firmLimitCatalogue(rows: Array<{ key: string; client_limit: number }> | null | undefined) {
  const out: Record<string, number> = {};
  for (const r of rows ?? []) out[r.key] = r.client_limit;
  return out;
}


export type FirmPlanView = {
  tier: FirmTier | null;
  status: string | null;
  isAlwaysFree: boolean;
  clientLimit: number;
  planLabel: string;
  statusLabel: string;
  statusTone: "emerald" | "sky" | "amber" | "red" | "slate";
  dueLabel: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
};

export function firmPlanView(input: {
  tier: string | null;
  status: string | null;
  is_always_free?: boolean | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
}): FirmPlanView {
  const isAlwaysFree = !!input.is_always_free;
  const tier = (input.tier ?? null) as FirmTier | null;
  const clientLimit = clientLimitFor(tier, isAlwaysFree);
  const status = input.status ?? null;
  const planLabel = isAlwaysFree
    ? "Free forever"
    : tier
    ? TIER_LABEL[tier] ?? "Legacy"
    : "No plan";

  let statusLabel = "No plan";
  let statusTone: FirmPlanView["statusTone"] = "slate";
  let dueLabel = "";

  const now = Date.now();
  const periodEndMs = input.current_period_end ? new Date(input.current_period_end).getTime() : null;
  const trialEndMs = input.trial_ends_at ? new Date(input.trial_ends_at).getTime() : null;

  if (isAlwaysFree || tier === "free") {
    statusLabel = "Free";
    statusTone = "slate";
  } else if (!tier || !status) {
    statusLabel = "No plan";
    statusTone = "slate";
  } else if (status === "trialing") {
    const days = trialEndMs ? Math.max(0, Math.ceil((trialEndMs - now) / 86400000)) : null;
    statusLabel = days != null ? `Trial · ${days}d left` : "Trial";
    statusTone = "sky";
    if (trialEndMs) dueLabel = `Trial ends ${new Date(trialEndMs).toLocaleDateString()}`;
  } else if (status === "active") {
    statusLabel = "Active";
    statusTone = "emerald";
    if (periodEndMs) dueLabel = `Renews ${new Date(periodEndMs).toLocaleDateString()}`;
  } else if (status === "past_due") {
    statusLabel = "Overdue";
    statusTone = "amber";
    if (periodEndMs) dueLabel = `Was due ${new Date(periodEndMs).toLocaleDateString()}`;
  } else if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    statusLabel = "Cancelled";
    statusTone = "red";
    if (periodEndMs) dueLabel = `Ended ${new Date(periodEndMs).toLocaleDateString()}`;
  } else {
    statusLabel = status;
    statusTone = "slate";
  }

  return {
    tier,
    status,
    isAlwaysFree,
    clientLimit,
    planLabel,
    statusLabel,
    statusTone,
    dueLabel,
    currentPeriodEnd: input.current_period_end ?? null,
    trialEndsAt: input.trial_ends_at ?? null,
  };
}

export function toneClasses(tone: FirmPlanView["statusTone"]): string {
  switch (tone) {
    case "emerald": return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
    case "sky": return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900";
    case "amber": return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
    case "red": return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900";
    default: return "bg-muted text-muted-foreground border-border";
  }
}
