import type { Classification, ResolvedClassification } from "@/lib/cost-classification";

/**
 * One rule for splitting a P&L's cost lines into fixed and variable for
 * break-even, covering BOTH sections of the report.
 *
 * Cost of sales used to be added as a single unclassified lump, so an account
 * tagged Fixed on the classification panel (typically wages posted to cost of
 * sales) was displayed as fixed and then silently treated as variable by the
 * calculation. Cost-of-sales lines now resolve through the same resolver as
 * operating expenses.
 *
 * The ONLY difference between the sections is the fallback when nothing has
 * decided a line:
 *   - operating expenses  -> fixed   (unchanged; counted as unclassified)
 *   - cost of sales       -> variable (the sensible seed for cost of sales, and
 *                            what every client saw before this change)
 *
 * The resolver's own precedence (stored tag, then Xero account type, then the
 * fixed fallback) is untouched: only `decided === null` cost-of-sales lines take
 * the variable fallback.
 */

export type PnlLine = { name: string; amount: number };

export type BreakevenLine = {
  name: string;
  amount: number;
  unclassified: boolean;
  section: "cogs" | "operating";
};

export type BreakevenLineSplit = {
  fixedLines: BreakevenLine[];
  variableLines: BreakevenLine[];
  fixedTotal: number;
  variableTotal: number;
  excludedTotal: number;
  excludedCount: number;
  unclassifiedCount: number;
  /** Plug so the operating-expense lines reconcile to Xero's reported total. */
  unitemisedBalance: number;
  /** Plug so the cost-of-sales lines reconcile to Xero's reported total. */
  cogsUnitemisedBalance: number;
};

const TOL = 0.5;

export function classifyBreakevenLines({
  expenseLines,
  cogsLines,
  totalExpenses,
  totalCostOfSales,
  resolve,
  classificationEnabled,
}: {
  expenseLines: PnlLine[];
  cogsLines: PnlLine[];
  totalExpenses: number;
  totalCostOfSales: number;
  resolve: (accountName: string) => ResolvedClassification;
  classificationEnabled: boolean;
}): BreakevenLineSplit {
  const fixedLines: BreakevenLine[] = [];
  const variableLines: BreakevenLine[] = [];
  let fixedTotal = 0;
  let variableTotal = 0;
  let excludedTotal = 0;
  let excludedCount = 0;
  let unclassifiedCount = 0;
  let unitemisedBalance = 0;
  let cogsUnitemisedBalance = 0;

  // Classification switched off, or nothing itemised: behave exactly as before.
  if (!classificationEnabled || expenseLines.length === 0) {
    fixedTotal = totalExpenses;
    for (const line of expenseLines) {
      fixedLines.push({ ...line, unclassified: true, section: "operating" });
    }
  } else {
    for (const line of expenseLines) {
      const r = resolve(line.name);
      place(r.effective, line, "operating", r.unclassified);
    }
    const linesTotal = fixedTotal + variableTotal + excludedTotal;
    if (Math.abs(linesTotal - totalExpenses) > TOL) {
      unitemisedBalance = totalExpenses - linesTotal;
      fixedTotal += unitemisedBalance;
    }
  }

  if (!classificationEnabled || cogsLines.length === 0) {
    variableTotal += totalCostOfSales;
  } else {
    let cogsSeen = 0;
    for (const line of cogsLines) {
      const r = resolve(line.name);
      // Fallback for cost of sales is variable, not the resolver's fixed default.
      const effective: Classification = r.decided ?? "variable";
      place(effective, line, "cogs", false);
      cogsSeen += line.amount;
    }
    if (Math.abs(cogsSeen - totalCostOfSales) > TOL) {
      cogsUnitemisedBalance = totalCostOfSales - cogsSeen;
      variableTotal += cogsUnitemisedBalance;
    }
  }

  fixedLines.sort((a, b) => b.amount - a.amount);
  variableLines.sort((a, b) => b.amount - a.amount);

  return {
    fixedLines,
    variableLines,
    fixedTotal,
    variableTotal,
    excludedTotal,
    excludedCount,
    unclassifiedCount,
    unitemisedBalance,
    cogsUnitemisedBalance,
  };

  function place(
    effective: Classification,
    line: PnlLine,
    section: "cogs" | "operating",
    unclassified: boolean,
  ) {
    if (effective === "variable") {
      variableTotal += line.amount;
      variableLines.push({ ...line, unclassified: false, section });
    } else if (effective === "excluded") {
      excludedTotal += line.amount;
      excludedCount += 1;
    } else {
      fixedTotal += line.amount;
      fixedLines.push({ ...line, unclassified, section });
      if (unclassified) unclassifiedCount += 1;
    }
  }
}
