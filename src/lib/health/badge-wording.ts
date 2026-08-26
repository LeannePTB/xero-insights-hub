// Staff badge wording.
//
// The canonical wording lives in the rules engine and is written for a
// DELIVERED DOCUMENT: descriptive, no judgement, no imperative. The client-list
// badge has about thirty characters, so it abbreviates that canonical wording
// here.
//
// The direction is one-way on purpose: a badge phrase must never leak into a
// document. Nothing in this file is imported by the report.

import type { Verdict } from "./rules.server";

/**
 * Short badge labels, keyed by rule id then severity. A rule with no entry
 * falls back to the canonical title, truncated by the badge's own CSS.
 */
const BADGE_TITLES: Record<string, Partial<Record<string, string>>> = {
  R01: {
    critical: "Protected money over cash",
    warning: "Protected money near cash",
    watch: "Protected money over half cash",
  },
  R05: {
    warning: "Statutory balances large",
    watch: "Statutory balances building",
  },
  R06: {
    critical: "Debtors 90+ days",
    warning: "Debtor book overdue",
    watch: "Debtors concentrated",
  },
};

/** The label to print on the staff badge for a verdict. */
export function badgeLabel(verdict: Verdict): string {
  if (verdict.state === "ok") return "Nothing to action";
  if (verdict.state !== "issues") return verdict.label;
  return BADGE_TITLES[verdict.topRuleId]?.[verdict.severity] ?? verdict.label;
}

/** The short label for one finding inside the badge tooltip. */
export function badgeFindingTitle(ruleId: string, severity: string, canonical: string): string {
  return BADGE_TITLES[ruleId]?.[severity] ?? canonical;
}
