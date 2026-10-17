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
  | { id: string; kind: "injection"; label: string; amount: number; month: string; repayment?: number }
  | { id: string; kind: "cost_change"; label: string; pct: number; start: string }
  | { id: string; kind: "debt_repayment"; label: string; amounts: Record<string, number> };

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
      else if (a.kind === "cost_change" && m >= a.start) c += baseCosts * (a.pct / 100);
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
      // Faster payment cannot beat same-month collection in a flat projection.
      const delay = Math.max(0, slow.filter((s) => months[j]! >= s.start).reduce((d, s) => d + s.days, 0)) / 30.4;
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
      if (a.kind === "debt_repayment") oneOff -= a.amounts[m] ?? 0;
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
/** Contribution margin: share of each sales dollar left after cost of sales
 *  and variable costs. The ONE break-even ratio; null without sales. */
export function contributionMargin(baseline: Baseline): number | null {
  return baseline.revenue > 0 ? (baseline.revenue - baseline.costs.cogs - baseline.costs.variable) / baseline.revenue : null;
}

export function breakEvenImpact(baseline: Baseline, rows: ProjectionRow[]): { extraCost: number; extraSales: number | null; margin: number | null } {
  const last = rows[rows.length - 1];
  if (!last) return { extraCost: 0, extraSales: null, margin: null };
  const extraCost = r2(last.scenario.costs - last.baseline.costs);
  const margin = contributionMargin(baseline);
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
  cases?: CasePair | null;
  target?: { amount: number; per: "month" | "year" } | null;
  debts?: Debt[];
  tax?: { pct: number; instalmentPct: number } | null;
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
    cases: p.cases && typeof p.cases === "object" ? p.cases : null,
    target: p.target && typeof p.target.amount === "number" ? p.target : null,
    debts: Array.isArray(p.debts) ? p.debts.slice(0, 20) : [],
    tax: p.tax && typeof p.tax.pct === "number" ? p.tax : null,
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

export type ScenarioSnapshot = { name: string; extras: { label: string; value: string }[]; rows: { month: string; baselineNet: number; scenarioNet: number; baselineCash: number | null; scenarioCash: number | null }[] };

/** The frozen report table on a report row, or null. Display only. */
export function scenarioSnapshotFrom(raw: unknown): ScenarioSnapshot | null {
  const s = raw as any;
  if (!s || s.kind !== "cashflow_scenario" || !Array.isArray(s.rows) || typeof s.name !== "string") return null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const extras = Array.isArray(s.extras) ? s.extras.slice(0, 12).filter((e: any) => typeof e?.label === "string" && typeof e?.value === "string").map((e: any) => ({ label: e.label.slice(0, 80), value: e.value.slice(0, 160) })) : [];
  return { name: s.name.slice(0, 120), extras, rows: s.rows.slice(0, 7).map((r: any) => ({ month: String(r.month ?? "").slice(0, 7), baselineNet: n(r.baselineNet) ?? 0, scenarioNet: n(r.scenarioNet) ?? 0, baselineCash: n(r.baselineCash), scenarioCash: n(r.scenarioCash) })) };
}


// ---------------------------------------------------------------------------
// Best / worst case
// ---------------------------------------------------------------------------
export type CaseAssumptions = { salesPct: number; payDays: number; costsPct: number };
export type CasePair = { best: CaseAssumptions; worst: CaseAssumptions };
export const DEFAULT_CASES: CasePair = { best: { salesPct: 10, payDays: -7, costsPct: 0 }, worst: { salesPct: -15, payDays: 30, costsPct: 5 } };

/** The scenario's adjustments plus one case's assumptions, from the first month. */
export function caseAdjustments(base: Adjustment[], c: CaseAssumptions, start: string): Adjustment[] {
  const out = [...base];
  if (c.salesPct) out.push({ id: "case-sales", kind: "price", label: "Case sales", pct: c.salesPct, start });
  if (c.payDays) out.push({ id: "case-pay", kind: "slower_pay", label: "Case payment timing", days: c.payDays, start });
  if (c.costsPct) out.push({ id: "case-costs", kind: "cost_change", label: "Case costs", pct: c.costsPct, start });
  return out;
}

/** Lowest projected closing cash and its month; null without an opening figure. */
export function lowestCash(rows: ProjectionRow[], which: "baseline" | "scenario" = "scenario"): { month: string; amount: number } | null {
  let low: { month: string; amount: number } | null = null;
  for (const r of rows) {
    const c = r[which].closingCash;
    if (c !== null && (!low || c < low.amount)) low = { month: r.month, amount: c };
  }
  return low;
}

// ---------------------------------------------------------------------------
// Target profit: sales needed (same contribution margin as break-even)
// ---------------------------------------------------------------------------
export function salesForTarget(input: {
  baseline: Baseline;
  /** Scenario fixed costs per month, incl. wages and any hires. */
  fixedCosts: number;
  targetPerMonth: number;
  averageInvoice: number | null;
}): { salesNeeded: number; gap: number; gapPct: number | null; invoices: number | null; priceRisePct: number | null } | null {
  const margin = contributionMargin(input.baseline);
  if (margin === null || margin <= 0) return null;
  const salesNeeded = r2(Math.max(0, (input.fixedCosts + input.targetPerMonth) / margin));
  const current = input.baseline.revenue;
  const gap = r2(salesNeeded - current);
  const variable = input.baseline.costs.cogs + input.baseline.costs.variable;
  // Same volume, higher prices: costs unchanged, revenue scales.
  const priceRisePct = current > 0 ? r2(((input.targetPerMonth + input.fixedCosts + variable) / current - 1) * 100) : null;
  return {
    salesNeeded,
    gap,
    gapPct: current > 0 ? r2((gap / current) * 100) : null,
    invoices: input.averageInvoice && input.averageInvoice > 0 && gap > 0 ? Math.ceil(gap / input.averageInvoice) : input.averageInvoice ? 0 : null,
    priceRisePct,
  };
}

// ---------------------------------------------------------------------------
// Debt repayment
// ---------------------------------------------------------------------------
export type Debt = { id: string; name: string; balance: number; ratePct: number; mode: "payment" | "term"; payment?: number; termMonths?: number; start: string };
export type DebtSchedule = { rows: { month: string; payment: number; interest: number; principal: number; balance: number }[]; payoffMonth: string | null; totalInterest: number; monthlyPayment: number; neverPaysOff: boolean };

/** Level-payment amount that clears `balance` in `n` months at `ratePct` a year. */
export function paymentForTerm(balance: number, ratePct: number, n: number): number {
  if (n <= 0) return r2(balance);
  const r = ratePct / 100 / 12;
  return r2(r === 0 ? balance / n : (balance * r) / (1 - Math.pow(1 + r, -n)));
}

export function debtSchedule(d: Debt, maxMonths = 360): DebtSchedule {
  const r = Math.max(0, d.ratePct) / 100 / 12;
  const payment = d.mode === "term" ? paymentForTerm(d.balance, d.ratePct, d.termMonths ?? 12) : Math.max(0, d.payment ?? 0);
  const months = monthsAhead(d.start, maxMonths);
  const rows: DebtSchedule["rows"] = [];
  let bal = Math.max(0, d.balance), totalInterest = 0;
  if (bal > 0 && payment <= bal * r + 0.005) return { rows: [], payoffMonth: null, totalInterest: 0, monthlyPayment: payment, neverPaysOff: true };
  for (const m of months) {
    if (bal <= 0.005) break;
    const interest = r2(bal * r);
    const pay = Math.min(payment, r2(bal + interest));
    bal = r2(bal + interest - pay);
    totalInterest += interest;
    rows.push({ month: m, payment: pay, interest, principal: r2(pay - interest), balance: bal });
  }
  return { rows, payoffMonth: bal <= 0.005 ? rows[rows.length - 1]?.month ?? d.start : null, totalInterest: r2(totalInterest), monthlyPayment: payment, neverPaysOff: false };
}

/** All debts' repayments as one projection adjustment (cash out by month). */
export function debtAdjustment(debts: Debt[]): Adjustment | null {
  if (!debts.length) return null;
  const amounts: Record<string, number> = {};
  for (const d of debts) for (const row of debtSchedule(d).rows) amounts[row.month] = r2((amounts[row.month] ?? 0) + row.payment);
  return { id: "debts", kind: "debt_repayment", label: "Debt repayments", amounts };
}

/** Months where closing cash falls below zero. */
export function belowZeroMonths(rows: ProjectionRow[]): string[] {
  return rows.filter((r) => r.scenario.closingCash !== null && r.scenario.closingCash < 0).map((r) => r.month);
}

// ---------------------------------------------------------------------------
// Tax set-aside
// ---------------------------------------------------------------------------
export type TaxDue = { label: string; due: string; amount: number };
export type SetAsideResult = {
  monthly: number[];
  weeklyFirst: number;
  checks: { label: string; due: string; amount: number; balanceBefore: number; covered: boolean; difference: number }[];
};

/** Set aside pct% (+ instalment pct%) of each month's income; test it against
 *  each known tax due, in due-date order, paying each from the set-aside. */
export function taxSetAside(income: { month: string; amount: number }[], pct: number, instalmentPct: number, dues: TaxDue[], opening = 0): SetAsideResult {
  const rate = Math.max(0, pct + instalmentPct) / 100;
  const monthly = income.map((i) => r2(Math.max(0, i.amount) * rate));
  let bal = opening;
  const checks: SetAsideResult["checks"] = [];
  const sorted = [...dues].sort((a, b) => a.due.localeCompare(b.due));
  let k = 0;
  income.forEach((inc, idx) => {
    // A due in this month is paid before this month's transfer lands.
    while (k < sorted.length && sorted[k]!.due.slice(0, 7) <= inc.month) {
      const d = sorted[k++]!;
      checks.push({ ...d, balanceBefore: r2(bal), covered: bal + 0.005 >= d.amount, difference: r2(bal - d.amount) });
      bal = Math.max(0, bal - d.amount);
    }
    bal += monthly[idx]!;
  });
  return { monthly, weeklyFirst: r2(((monthly[0] ?? 0) * 12) / 52), checks };
}
