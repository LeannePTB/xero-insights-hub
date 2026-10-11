// The one rule for "protected money vs cash": tax and super owed as a share of
// CASH AT BANK (the client's selected bank accounts), never net cash. Pure;
// used by the health rule (R01 → badges, verdicts, reports), the Overview and
// Trixie.

import { R01_PROTECTED_MONEY } from "./rule-thresholds";

export type ProtectedShareLevel = "critical" | "warning" | "watch" | null;

export type ProtectedShare = {
  /** Protected ÷ cash at bank; null when cash at bank is zero or negative. */
  ratio: number | null;
  /** ratio × 100, or null. */
  pct: number | null;
  level: ProtectedShareLevel;
  tooltip: string;
};

export const NO_CASH_TO_COMPARE = "No cash at bank to compare";

export function protectedShareOfCash(protectedMoney: number, cashAtBank: number): ProtectedShare {
  const t = R01_PROTECTED_MONEY;
  if (!(cashAtBank > 0)) {
    // Owing something with no cash at bank is the worst case for the health
    // rule, but no percentage is shown.
    return { ratio: null, pct: null, level: protectedMoney > 0 ? "critical" : null, tooltip: NO_CASH_TO_COMPARE };
  }
  const ratio = protectedMoney / cashAtBank;
  const level: ProtectedShareLevel =
    ratio >= t.criticalRatio ? "critical" : ratio >= t.warningRatio ? "warning" : ratio >= t.watchRatio ? "watch" : null;
  const tooltip =
    level === "critical"
      ? "Tax and super owed is more than cash at bank."
      : level === "warning"
        ? "Tax and super owed is close to cash at bank."
        : level === "watch"
          ? "Tax and super owed is over half of cash at bank."
          : "Cash at bank covers tax and super owed.";
  return { ratio, pct: ratio * 100, level, tooltip };
}
