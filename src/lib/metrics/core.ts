// The single implementation of the supporting business metrics.
//
// Pure functions, no imports. Both the dashboard Business Health widget and the
// Monthly Management Report call these, so a figure can never disagree between
// what is on screen and what was posted to the client.
//
// Nothing here scores, rates or grades. Scoring stays in the dashboard widget;
// the report shows the metric and nothing else.

/** Net profit as a percentage of revenue. Null when there is no revenue. */
export function netMarginPct(netProfit: number, revenue: number): number | null {
  if (!Number.isFinite(revenue) || revenue <= 0) return null;
  return (netProfit / revenue) * 100;
}

/** Cash at bank divided by average monthly operating expenditure. */
export function monthsRunway(cash: number, monthlyOpex: number): number | null {
  if (!Number.isFinite(monthlyOpex) || monthlyOpex <= 0) return null;
  return cash / monthlyOpex;
}

/**
 * Debtor days (DSO) over the period: receivables outstanding relative to the
 * revenue earned across `periodDays`.
 */
export function debtorDays(
  receivables: number,
  revenue: number,
  periodDays: number,
): number | null {
  if (!Number.isFinite(revenue) || revenue <= 0) return null;
  if (!Number.isFinite(periodDays) || periodDays <= 0) return null;
  return (receivables / revenue) * periodDays;
}

/** Current assets less current liabilities. */
export function workingCapital(currentAssets: number, currentLiabilities: number): number {
  return currentAssets - currentLiabilities;
}

/** Working capital expressed as months of operating expenditure. */
export function workingCapitalMonths(
  currentAssets: number,
  currentLiabilities: number,
  monthlyOpex: number,
): number | null {
  if (!Number.isFinite(monthlyOpex) || monthlyOpex <= 0) return null;
  return workingCapital(currentAssets, currentLiabilities) / monthlyOpex;
}
