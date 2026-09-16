/**
 * Presentation helpers for an organisation trial. The database decides whether a
 * trial is live (`trialActive`); this only formats it. Purchased options are
 * never described as a trial: an organisation with nothing trialled reads as
 * having no trial at all, which is the state every organisation is in today.
 */

export const TRIAL_MAX_DAYS = 120;
/** Amber from here on. Long enough to talk to the customer before it lapses. */
export const TRIAL_WARN_DAYS = 14;

export type TrialShape = {
  trialAdvisory: boolean;
  trialConsolidation: boolean;
  trialEndsAt: string | null;
  trialActive: boolean;
};

export function trialDaysLeft(endsAt: string | null, now: Date = new Date()): number | null {
  if (!endsAt) return null;
  const when = new Date(endsAt);
  if (Number.isNaN(when.getTime())) return null;
  return Math.ceil((when.getTime() - now.getTime()) / 86_400_000);
}

/** "6 December 2026" — the exact date, visible from the day the trial starts. */
export function trialEndLabel(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const when = new Date(endsAt);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export type TrialStatus =
  | { kind: "none" }
  | { kind: "expired"; endsAt: string; endLabel: string }
  | { kind: "active"; endsAt: string; endLabel: string; daysLeft: number; warn: boolean; grants: string };

export function trialStatus(t: TrialShape, now: Date = new Date()): TrialStatus {
  const trialled = t.trialAdvisory || t.trialConsolidation;
  if (!trialled || !t.trialEndsAt) return { kind: "none" };
  const endLabel = trialEndLabel(t.trialEndsAt) ?? t.trialEndsAt;
  if (!t.trialActive) return { kind: "expired", endsAt: t.trialEndsAt, endLabel };
  const daysLeft = trialDaysLeft(t.trialEndsAt, now) ?? 0;
  const grants = [t.trialAdvisory ? "Advisory" : null, t.trialConsolidation ? "Consolidation" : null]
    .filter(Boolean)
    .join(" and ");
  return {
    kind: "active",
    endsAt: t.trialEndsAt,
    endLabel,
    daysLeft,
    warn: daysLeft <= TRIAL_WARN_DAYS,
    grants,
  };
}
