// Shared, client-safe shapes and copy for organisation subscription expiry.
//
// Every date and day count here comes from public.firm_subscription_state —
// nothing on this page recomputes an expiry or a countdown in TypeScript.

export type SubscriptionState = {
  firmId: string;
  planKey: string | null;
  planLabel: string | null;
  status: string | null;
  lapsed: boolean;
  alwaysFree: boolean;
  /** True when the organisation's plan is a free plan level (e.g. PTB). */
  isFree: boolean;
  endsAt: string | null;
  daysRemaining: number | null;
  endingSoon: boolean;
  consolidation: boolean;
};

/** "31 August 2026" — Australian long form. */
export function formatEndDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

/** True when no billing or expiry date should ever be shown. */
export function hidesDates(s: Pick<SubscriptionState, "alwaysFree" | "isFree">): boolean {
  return s.alwaysFree || s.isFree;
}

/** "ends in 6 days" / "ends today". Null when there is nothing to count down to. */
export function countdownLabel(s: SubscriptionState): string | null {
  if (hidesDates(s) || s.lapsed) return null;
  if (s.daysRemaining == null) return null;
  if (s.daysRemaining <= 0) return "ends today";
  return `ends in ${s.daysRemaining} day${s.daysRemaining === 1 ? "" : "s"}`;
}

/** The plain-English consequence, used by the banners and the staff notice. */
export function consequenceCopy(s: SubscriptionState): string {
  const date = formatEndDate(s.endsAt);
  if (s.lapsed) {
    return `This organisation's subscription ended${date ? ` on ${date}` : ""}. Its clients are now on the Standard dashboard and the consolidation tools are switched off.`;
  }
  const when = date ? `On ${date}` : "When this ends";
  const status = s.status === "trialing" ? "the trial ends" : "the subscription ends";
  return `${when} ${status}. This organisation's clients will move to the Standard dashboard and the consolidation tools will switch off.`;
}
