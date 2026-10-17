// Cash flow scenario "what if" adjustments. Pure maths, shared by the page,
// saved scenarios, the report table and tests. Every figure is a projection.

export type CostTarget = "fixed" | "variable" | "cogs";

export type Adjustment =
  | { id: string; kind: "hire"; label: string; pay: "salary" | "hourly"; salary?: number; hourlyRate?: number; hoursPerWeek?: number; superPct: number; onCostPct: number; start: string; end?: string | null }
  | { id: string; kind: "price"; label: string; pct: number; customers?: string[]; start: string }
  | { id: string; kind: "new_cost"; label: string; amount: number; category: "fixed" | "variable"; start: string; end?: string | null }
  | { id: string; kind: "cut_cost"; label: string; target: CostTarget | `account:${string}`; mode: "pct" | "amount"; value: number; start: string }
  | { id: string; kind: "slower_pay"; label: string; days: number; start: string }
  | { id: string; kind: "one_off"; label: string; amount: number; month: string }
  | { id: string; kind: "injection"; label: string; amount: number; month: string; repayment?: number };

export const DEFAULT_SG_RATE = 12;

const r2 = (n: number) => Math.round(n * 100) / 100;
const active = (m: string, start: string, end?: string | null) => m >= start && (!end || m <= end);

/** Monthly cost of a hire: pay × (1 + super% + on-cost%). Hourly uses 52 weeks / 12 months. */
export function hireMonthlyCost(a: { pay: "salary" | "hourly"; salary?: number; hourlyRate?: number; hoursPerWeek?: number; superPct: number; onCostPct: number }): number {
  const base = a.pay === "salary" ? (a.salary ?? 0) / 12 : ((a.hourlyRate ?? 0) * (a.hoursPerWeek ?? 0) * 52) / 12;
  return r2(Math.max(0, base) * (1 + (a.superPct || 0) / 100 + (a.onCostPct || 0) / 100));
}

/** Month keys "YYYY-MM": start and the next `count - 1`. */
export function monthsAhead(start: string, count: number): string[] {
  const [y, m] = start.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y!, m! - 1 + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export type Baseline = {
  /** Revenue for the chosen month after invoice exclusions (excl. GST). */
  revenue: number;
  /** Revenue by customer for the chosen month (after exclusions). */
  revenueByCustomer: Record<string, number>;
  costs: Record<CostTarget, number>;
  /** Chosen month's expense by account name (for "cut an existing cost"). */
  accounts: Record<string, { amount: number; group: CostTarget }>;
};

export type ProjectionRow = {
  month: string;
  baseline: { revenue: number; costs: number; net: number; cashIn: number; cashMovement: number; closingCash: number | null };
  scenario: { revenue: number; costs: number; net: number; cashIn: number; cashMovement: number; closingCash: number | null };
};

/** Flat projection: the chosen month repeated, with adjustments applied by month. */
export function project(baseline: Baseline, adjustments: Adjustment[], months: string[], openingCash: number | null = null): ProjectionRow[] {
  const baseCosts = baseline.costs.fixed + baseline.costs.variable + baseline.costs.cogs;
  const scenRevenue = months.map((m) => {
    let rev = baseline.revenue;
    for (const a of adjustments) {
      if (a.kind !== "price" || m < a.start) continue;
      const pool = a.customers?.length ? a.customers.reduce((s, c) => s + (baseline.revenueByCustomer[c] ?? 0), 0) : baseline.revenue;
      rev += pool * (a.pct / 100);
    }
    return rev;
  });
  const scenCosts = months.map((m) => {
    let c = baseCosts;
    for (const a of adjustments) {
      if (a.kind === "hire" && active(m, a.start, a.end)) c += hireMonthlyCost(a);
      else if (a.kind === "new_cost" && active(m, a.start, a.end)) c += a.amount;
      else if (a.kind === "cut_cost" && m >= a.start) {
        const pool = a.target.startsWith("account:") ? (baseline.accounts[a.target.slice(8)]?.amount ?? 0) : baseline.costs[a.target as CostTarget];
        c -= Math.min(Math.max(pool, 0), a.mode === "pct" ? pool * (a.value / 100) : a.value);
      }
    }
    return c;
  });
  // Customers paying slower: from the start month, invoices are collected
  // `days` later, spread across the month they slip into.
  const slow = adjustments.filter((a): a is Extract<Adjustment, { kind: "slower_pay" }> => a.kind === "slower_pay");
  const cashIn = months.map((_, i) => {
    let total = 0;
    for (let j = 0; j <= i; j++) {
      const delay = slow.filter((s) => months[j]! >= s.start).reduce((d, s) => d + s.days, 0) / 30.4;
      const whole = Math.floor(delay), frac = delay - whole;
      if (j + whole === i) total += scenRevenue[j]! * (1 - frac);
      if (j + whole + 1 === i) total += scenRevenue[j]! * frac;
    }
    return total;
  });
  let bCash = openingCash, sCash = openingCash;
  return months.map((m, i) => {
    let oneOff = 0;
    for (const a of adjustments) {
      if (a.kind === "one_off" && a.month === m) oneOff -= a.amount;
      if (a.kind === "injection") {
        if (a.month === m) oneOff += a.amount;
        else if (m > a.month && a.repayment) oneOff -= a.repayment;
      }
    }
    const sIn = slow.length ? cashIn[i]! : scenRevenue[i]!;
    const bMove = baseline.revenue - baseCosts;
    const sMove = sIn - scenCosts[i]! + oneOff;
    if (bCash !== null) bCash += bMove;
    if (sCash !== null) sCash += sMove;
    return {
      month: m,
      baseline: { revenue: r2(baseline.revenue), costs: r2(baseCosts), net: r2(bMove), cashIn: r2(baseline.revenue), cashMovement: r2(bMove), closingCash: bCash === null ? null : r2(bCash) },
      scenario: { revenue: r2(scenRevenue[i]!), costs: r2(scenCosts[i]!), net: r2(scenRevenue[i]! - scenCosts[i]!), cashIn: r2(sIn), cashMovement: r2(sMove), closingCash: sCash === null ? null : r2(sCash) },
    };
  });
}

/** Extra sales per month needed to cover the scenario's extra running costs
 *  at the baseline contribution margin (sales less cost of sales and variable). */
export function breakEvenImpact(baseline: Baseline, rows: ProjectionRow[]): { extraCost: number; extraSales: number | null; margin: number | null } {
  const last = rows[rows.length - 1];
  if (!last) return { extraCost: 0, extraSales: null, margin: null };
  const extraCost = r2(last.scenario.costs - last.baseline.costs);
  const margin = baseline.revenue > 0 ? (baseline.revenue - baseline.costs.cogs - baseline.costs.variable) / baseline.revenue : null;
  return { extraCost, margin, extraSales: margin && margin > 0 ? r2(Math.max(0, extraCost) / margin) : null };
}

export type ScenarioPayload = {
  version: 1;
  month: string;
  horizon: number;
  openingCash: number | null;
  adjustments: Adjustment[];
  excludedInvoiceIds: string[];
  costBasis: unknown;
};

/** Validate a saved payload; unknown shapes load as empty rather than crash. */
export function parsePayload(raw: unknown): ScenarioPayload | null {
  const p = raw as Partial<ScenarioPayload> | null;
  if (!p || p.version !== 1 || !Array.isArray(p.adjustments) || !Array.isArray(p.excludedInvoiceIds)) return null;
  return {
    version: 1,
    month: typeof p.month === "string" ? p.month : "",
    horizon: Math.min(6, Math.max(3, Number(p.horizon) || 3)),
    openingCash: typeof p.openingCash === "number" ? p.openingCash : null,
    adjustments: p.adjustments.slice(0, 50) as Adjustment[],
    excludedInvoiceIds: p.excludedInvoiceIds.filter((x) => typeof x === "string").slice(0, 2000),
    costBasis: p.costBasis ?? null,
  };
}

/** The frozen report table (small, totals only — never invoice detail). */
export function reportTable(rows: ProjectionRow[]) {
  return { kind: "cashflow_scenario" as const, rows: rows.map((r) => ({ month: r.month, baselineNet: r.baseline.net, scenarioNet: r.scenario.net, baselineCash: r.baseline.closingCash, scenarioCash: r.scenario.closingCash })) };
}

/** Invoice list helpers: filter to one customer, and "select all" over what is shown. */
export function filterInvoices<T extends { customer_id: string | null }>(invoices: T[], customer: string): T[] {
  return customer ? invoices.filter((i) => (i.customer_id ?? "Unassigned") === customer) : invoices;
}
export function selectAllState(shownIds: string[], selected: Set<string>): "none" | "some" | "all" {
  const n = shownIds.filter((id) => selected.has(id)).length;
  return n === 0 ? "none" : n === shownIds.length ? "all" : "some";
}
export function toggleSelectAll(shownIds: string[], selected: Set<string>): Set<string> {
  const next = new Set(selected);
  if (selectAllState(shownIds, selected) === "all") shownIds.forEach((id) => next.delete(id));
  else shownIds.forEach((id) => next.add(id));
  return next;
}
