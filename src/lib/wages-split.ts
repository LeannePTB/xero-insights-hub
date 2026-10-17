// Pure: the ONE wages split. Source of truth is the Wages marker in Client
// settings → Cost classification. Presentation only — gross and net profit
// are never changed; wages are only shown on their own line.

export type WageMarkerRow = { account_name: string; classification?: string | null; is_wages?: boolean | null };

const norm = (s: string) => s.trim().toLowerCase();

/** Marked wage account names (normalised). Same rule as Business Health. */
export function wageAccountNames(rows: readonly WageMarkerRow[] | null | undefined): Set<string> {
  return new Set((rows ?? []).filter((r) => r.is_wages || r.classification === "wages").map((r) => norm(r.account_name)));
}

export type WagesSplit = {
  /** False when nothing is marked: show the totals unsplit. */
  split: boolean;
  costOfSalesExWages: number;
  wages: number;
  overheadsExWages: number;
  /** Marked accounts that appear in this P&L. */
  accountsFound: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Wages are pulled from wherever they sit (cost of sales or operating) and
 *  summed once; a name appearing in both sections is still one account. */
export function splitWages(input: {
  costOfSales: number; expenses: number;
  cogsLines: readonly { name: string; amount: number }[];
  expenseLines: readonly { name: string; amount: number }[];
}, names: ReadonlySet<string>): WagesSplit {
  if (names.size === 0) return { split: false, costOfSalesExWages: input.costOfSales, wages: 0, overheadsExWages: input.expenses, accountsFound: 0 };
  const found = new Set<string>();
  const sum = (lines: readonly { name: string; amount: number }[]) => lines.reduce((s, l) => {
    const n = norm(l.name);
    if (!names.has(n)) return s;
    found.add(n);
    return s + (Number(l.amount) || 0);
  }, 0);
  const inCogs = sum(input.cogsLines);
  const inOpex = sum(input.expenseLines);
  return {
    split: true,
    costOfSalesExWages: r2(input.costOfSales - inCogs),
    wages: r2(inCogs + inOpex),
    overheadsExWages: r2(input.expenses - inOpex),
    accountsFound: found.size,
  };
}

/** Wages in one period of a parsed multi-period P&L (cost of sales + operating). */
export function wagesFromSections(sections: readonly { kind: string; rows: readonly { name: string; values: readonly number[] }[] }[], i: number, names: ReadonlySet<string>): number | null {
  if (names.size === 0) return null;
  let t = 0;
  for (const s of sections) {
    if (s.kind !== "cost-of-sales" && s.kind !== "expenses") continue;
    for (const r of s.rows) if (names.has(norm(r.name))) t += Number(r.values[i]) || 0;
  }
  return r2(t);
}
