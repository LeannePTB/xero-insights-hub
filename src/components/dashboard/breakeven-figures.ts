/**
 * Pure break-even arithmetic for the Accounting Break-Even card.
 *
 * ONE BASIS: every money figure returned here is monthly. Period figures are
 * divided by `months` exactly once, here, so the two headline numbers on the
 * card are directly comparable and the verdict follows visibly from them.
 * `months` is the fractional length of the selected range (a whole calendar
 * month is 1.0), never below 0.1.
 */
export function breakevenFigures({
  income,
  totalVariable,
  fixedOpex,
  months,
}: {
  income: number;
  totalVariable: number;
  fixedOpex: number;
  months: number;
}) {
  const grossMargin = income > 0 ? (income - totalVariable) / income : 0;
  const periodBreakeven = grossMargin > 0 ? fixedOpex / grossMargin : 0;
  const periodOperatingResult = income - totalVariable - fixedOpex;
  const monthlyFixed = fixedOpex / months;
  const monthlyBreakeven = periodBreakeven / months;
  const monthlyIncome = income / months;
  const monthlyOperatingResult = periodOperatingResult / months;
  const aboveBreakeven = monthlyIncome >= monthlyBreakeven;
  return {
    grossMargin,
    monthlyFixed,
    monthlyBreakeven,
    monthlyIncome,
    monthlyOperatingResult,
    aboveBreakeven,
  };
}
