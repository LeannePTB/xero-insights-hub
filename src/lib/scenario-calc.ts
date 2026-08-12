import type { ScenarioCustomer, ScenarioExpense, ScenarioInvoice } from "@/lib/scenario.functions";

export function monthKey(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Every month present in the data, oldest first, always including the current month. */
export function monthsFrom(invoices: ScenarioInvoice[], expenses: ScenarioExpense[]): string[] {
  const set = new Set<string>([currentMonthKey()]);
  for (const i of invoices) set.add(monthKey(i.issue_date));
  for (const e of expenses) set.add(monthKey(e.date));
  return [...set].sort();
}

export type Matrix = {
  months: string[];
  rows: { customerId: string | null; name: string; cells: number[]; total: number }[];
  columnTotals: number[];
  grandTotal: number;
};

export function buildMatrix(
  customers: ScenarioCustomer[],
  invoices: ScenarioInvoice[],
  months: string[],
  { includeExcluded = false }: { includeExcluded?: boolean } = {},
): Matrix {
  const index = new Map(months.map((m, i) => [m, i]));
  const names = new Map<string | null, string>(customers.map((c) => [c.id, c.name]));
  const byCustomer = new Map<string | null, number[]>();

  for (const inv of invoices) {
    if (inv.excluded && !includeExcluded) continue;
    const col = index.get(monthKey(inv.issue_date));
    if (col === undefined) continue;
    const key = inv.customer_id;
    if (!byCustomer.has(key)) byCustomer.set(key, months.map(() => 0));
    byCustomer.get(key)![col] += inv.amount;
  }

  // Keep every known customer as a row, even at zero, so the matrix is stable.
  for (const c of customers) if (!byCustomer.has(c.id)) byCustomer.set(c.id, months.map(() => 0));

  const rows = [...byCustomer.entries()]
    .map(([customerId, cells]) => ({
      customerId,
      name: names.get(customerId) ?? "Unassigned",
      cells,
      total: cells.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const columnTotals = months.map((_, i) => rows.reduce((sum, r) => sum + (r.cells[i] ?? 0), 0));
  return { months, rows, columnTotals, grandTotal: columnTotals.reduce((a, b) => a + b, 0) };
}

export type Totals = {
  revenue: number;
  baselineRevenue: number;
  excludedRevenue: number;
  fixed: number;
  variable: number;
  expenses: number;
  net: number;
  baselineNet: number;
};

/** Totals for a month key, or for the whole data set when month is null. */
export function computeTotals(
  invoices: ScenarioInvoice[],
  expenses: ScenarioExpense[],
  month: string | null,
): Totals {
  const inScope = (d: string) => (month ? monthKey(d) === month : true);
  let revenue = 0;
  let baselineRevenue = 0;
  for (const i of invoices) {
    if (!inScope(i.issue_date)) continue;
    baselineRevenue += i.amount;
    if (!i.excluded) revenue += i.amount;
  }
  let fixed = 0;
  let variable = 0;
  for (const e of expenses) {
    if (!inScope(e.date)) continue;
    if (e.type === "Variable") variable += e.amount;
    else fixed += e.amount;
  }
  const total = fixed + variable;
  return {
    revenue,
    baselineRevenue,
    excludedRevenue: baselineRevenue - revenue,
    fixed,
    variable,
    expenses: total,
    net: revenue - total,
    baselineNet: baselineRevenue - total,
  };
}

export function groupExpenses(expenses: ScenarioExpense[], type: "Fixed" | "Variable") {
  const map = new Map<string, ScenarioExpense[]>();
  for (const e of expenses) {
    if ((e.type === "Variable" ? "Variable" : "Fixed") !== type) continue;
    if (!map.has(e.category)) map.set(e.category, []);
    map.get(e.category)!.push(e);
  }
  return [...map.entries()]
    .map(([category, items]) => ({
      category,
      items,
      subtotal: items.reduce((a, b) => a + b.amount, 0),
    }))
    .sort((a, b) => b.subtotal - a.subtotal);
}
