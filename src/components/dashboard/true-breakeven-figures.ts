/**
 * Pure arithmetic for the cash commitments section of the Break-Even card
 * (the card key `true_breakeven`).
 *
 * Break-even covers the costs the profit and loss reports. It does NOT cover
 * money that still has to leave the bank: the principal part of a loan
 * repayment, equipment finance, tax set aside, an ATO payment plan or what the
 * owners draw. This module adds those to fixed costs and works out the revenue
 * needed to cover the lot.
 *
 * ONE BASIS: every figure in and out of here is per month, matching the rest of
 * the card. Nothing here changes the break-even calculation itself — it is an
 * additional figure alongside it.
 */

export type CashCommitments = {
  loan_principal: number;
  credit_card_interest: number;
  owner_drawings: number;
  tax_payments: number | null;
  ato_payment_plan: number;
  equipment_finance: number;
  other: number;
};

/**
 * The fields, in the order they are entered and displayed. Wording is for a
 * business owner: each line says what the money is, not which ledger it sits in.
 */
export const COMMITMENT_FIELDS = [
  {
    key: "loan_principal",
    label: "Loan repayments (the debt part)",
    hint: "Only the interest on a loan shows in your profit and loss. The part that pays the loan down still leaves the bank.",
  },
  {
    key: "equipment_finance",
    label: "Equipment and vehicle finance",
    hint: "Hire purchase, chattel mortgage or lease principal paid each month.",
  },
  {
    key: "credit_card_interest",
    label: "Credit card interest and fees",
    hint: "Only if it is not already showing as an expense in your profit and loss.",
  },
  {
    key: "tax_payments",
    label: "Tax set aside",
    hint: "Income tax or company tax you put away each month. Leave blank if you are not setting anything aside yet.",
  },
  {
    key: "ato_payment_plan",
    label: "ATO payment plan",
    hint: "Monthly instalments on an arrangement with the ATO.",
  },
  {
    key: "owner_drawings",
    label: "What the owners take out",
    hint: "Drawings or dividends — money taken from profit rather than paid as wages.",
  },
  {
    key: "other",
    label: "Anything else paid out of profit",
    hint: "Any other regular payment that never appears as an expense.",
  },
] as const satisfies readonly { key: keyof CashCommitments; label: string; hint: string }[];

export type CommitmentField = (typeof COMMITMENT_FIELDS)[number];

const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Total monthly money that leaves the bank but never reaches the profit and loss. */
export function commitmentsTotal(c: Partial<CashCommitments> | null | undefined): number {
  if (!c) return 0;
  return COMMITMENT_FIELDS.reduce((a, f) => a + num(c[f.key]), 0);
}

export function trueBreakevenFigures({
  monthlyFixed,
  grossMargin,
  monthlyIncome,
  commitments,
}: {
  monthlyFixed: number;
  /** Share of each sale left after variable costs, as a fraction (0.79 = 79%). */
  grossMargin: number;
  monthlyIncome: number;
  commitments: Partial<CashCommitments> | null | undefined;
}) {
  const monthlyCommitments = commitmentsTotal(commitments);
  const monthlyTotalToCover = monthlyFixed + monthlyCommitments;
  const monthlyRequiredRevenue = grossMargin > 0 ? monthlyTotalToCover / grossMargin : 0;
  return {
    monthlyCommitments,
    monthlyTotalToCover,
    monthlyRequiredRevenue,
    hasCommitments: monthlyCommitments > 0,
    /** Is the revenue actually coming in enough to cover the lot? */
    aboveRequired: monthlyRequiredRevenue > 0 && monthlyIncome >= monthlyRequiredRevenue,
    shortfall: Math.max(0, monthlyRequiredRevenue - monthlyIncome),
  };
}
