import type { CheckStatus } from "@/lib/health/health-checks";

/** Owner-approved Business Health tints, shared by health panels, tax tiles and
 *  payroll period rows. Colour follows Good / Monitor / Alert / No data. */
export const TONE: Record<CheckStatus, { box: string; pill: string; cell: string }> = {
  green: { box: "border-health-good bg-health-good-surface", pill: "border-health-good/40 bg-health-good-cell text-health-good", cell: "bg-health-good-cell" },
  watch: { box: "border-health-watch/60 bg-health-watch-surface", pill: "border-health-watch/30 bg-health-watch-cell text-health-watch", cell: "bg-health-watch-cell" },
  red: { box: "border-health-alert bg-health-alert-surface", pill: "border-health-alert/40 bg-health-alert-cell text-health-alert", cell: "bg-health-alert-cell" },
  na: { box: "border-border bg-card", pill: "border-border bg-muted text-muted-foreground", cell: "bg-muted" },
};

export type BillKind = "paid" | "not_due" | "due_today" | "overdue";

/** Paid / nothing owing → Good; not due / due today → Monitor; overdue → Alert. */
export function billTone(kind: BillKind): CheckStatus {
  return kind === "paid" ? "green" : kind === "overdue" ? "red" : "watch";
}

const RANK: Record<CheckStatus, number> = { red: 3, watch: 2, green: 1, na: 0 };
/** A tile with several lines takes its most serious line's tone. */
export function worstTone(tones: CheckStatus[], fallback: CheckStatus = "na"): CheckStatus {
  return tones.reduce<CheckStatus>((w, t) => (RANK[t] > RANK[w] ? t : w), tones.length ? tones[0]! : fallback);
}

export const PILL_BASE = "shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold";
