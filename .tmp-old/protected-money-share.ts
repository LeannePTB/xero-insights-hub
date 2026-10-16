// Protected money (tax and super set aside) as a share of CASH AT BANK, never
// net cash. Display only since 16 Oct 2026: it raises no alert and carries no
// colour. Alerts come from the tax rule in `health-checks.ts`. Used by the
// Overview and Trixie.

export type ProtectedShare = {
  /** Protected ÷ cash at bank; null when cash at bank is zero or negative. */
  ratio: number | null;
  /** ratio × 100, or null. */
  pct: number | null;
  tooltip: string;
};

export const NO_CASH_TO_COMPARE = "No cash at bank to compare";

export const ATO_REFUND_DUE = "ATO refund due — nothing to protect";

export function protectedShareOfCash(protectedMoney: number, cashAtBank: number): ProtectedShare {
  if (protectedMoney < 0) return { ratio: null, pct: null, tooltip: ATO_REFUND_DUE };
  if (!(cashAtBank > 0)) return { ratio: null, pct: null, tooltip: NO_CASH_TO_COMPARE };
  const ratio = protectedMoney / cashAtBank;
  return { ratio, pct: ratio * 100, tooltip: "Tax and super set aside, as a share of cash at bank." };
}
