// Business Health — three plain checks, no score.
//
// Pure and client-safe: no server imports. One function, `computeHealthChecks`,
// turns stored figures into the payload shown by the dashboard card, the
// client-list badge and the monthly report, so the three can never disagree.
// The loader that gathers the stored figures is `health-checks.server.ts`.

export type CheckStatus = "green" | "watch" | "red" | "na";
export type CheckKey = "profit" | "cash_cover" | "paying_on_time";

export type HealthCheck = {
  key: CheckKey;
  question: string;
  /** The headline figure, e.g. "$31.7k profit · 32.0% margin". */
  figure: string;
  /** Optional small breakdown line under the figure. */
  detail: string | null;
  status: CheckStatus;
  /** One short plain sentence on what the status means. */
  meaning: string;
};

export type HealthInfoLine = { key: "next_tax" | "old_debts"; text: string };

export type HealthChecks = {
  asOf: string;
  fyLabel: string;
  /** "2 of 3 on track". */
  headline: string;
  onTrack: number;
  /** Checks that produced a result (excludes "Not available"). */
  counted: number;
  checks: HealthCheck[];
  info: HealthInfoLine[];
  /** True when the financial year is too young for a profit verdict. */
  profitHeldBack: boolean;
};

// ---------------------------------------------------------------------------
// Thresholds (owner-set, 16 Oct 2026)
// ---------------------------------------------------------------------------
export const PROFIT_GREEN_MARGIN_PCT = 5;
export const CASH_COVER_GREEN_MONTHS = 2;
export const CASH_COVER_WATCH_MONTHS = 0.5;
export const RECENT_DEBTOR_DAYS = 90;
export const LATE_AFTER_DAYS = 14;
export const LATE_AMOUNT_FLOOR = 2000;
export const LATE_SHARE_GREEN_PCT = 20;
export const LATE_SHARE_WATCH_PCT = 50;
/** A financial year shorter than this is too young to call. */
export const PROFIT_MIN_DAYS = 14;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
type Row = { RowType?: string; Title?: string; Rows?: Row[]; Cells?: { Value?: string; Attributes?: { Id?: string; Value?: string }[] }[] };

export function parseAmount(v: string | number | undefined | null): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const n = Number(String(v).replace(/[, ]/g, "").replace(/^\((.*)\)$/, "-$1"));
  return Number.isFinite(n) ? n : 0;
}

function dayNumber(iso: string): number {
  return Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000);
}

/** Xero's "/Date(…)/" or an ISO date → "YYYY-MM-DD" (UTC calendar date). */
export function xeroDateISO(s: unknown): string | null {
  if (typeof s !== "string" || !s) return null;
  const m = s.match(/\/Date\((-?\d+)/);
  const d = m ? new Date(parseInt(m[1]!, 10)) : new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "$31.7k", "$118k", "$4,980", "-$2.1k". */
export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 100_000) return `${sign}$${Math.round(a / 1000)}k`;
  if (a >= 10_000) return `${sign}$${(a / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(a).toLocaleString("en-AU")}`;
}

function dayLabel(iso: string): string {
  return `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;
}
function monthYearLabel(iso: string): string {
  return `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
}

// ---------------------------------------------------------------------------
// Check 1 — Making money?
// ---------------------------------------------------------------------------

/** Xero's own Net Profit and Total Income rows, wherever they sit. */
export function readProfitRows(report: { Rows?: Row[] } | null | undefined): { netProfit: number | null; revenue: number | null } {
  let netProfit: number | null = null;
  let revenue: number | null = null;
  const walk = (rows: Row[] | undefined) => {
    for (const r of rows ?? []) {
      if (r.RowType === "Section") { walk(r.Rows); continue; }
      const name = (r.Cells?.[0]?.Value ?? "").trim().toLowerCase();
      const value = parseAmount(r.Cells?.[1]?.Value);
      if (name === "net profit") netProfit = value;
      else if (name === "net loss") netProfit = -Math.abs(value);
      else if (name === "total income" || name === "total trading income") revenue = (revenue ?? 0) + value;
    }
  };
  walk(report?.Rows);
  return { netProfit, revenue };
}

export function profitStatus(netProfit: number, revenue: number | null): CheckStatus {
  if (netProfit < 0) return "red";
  const margin = revenue && revenue > 0 ? (netProfit / revenue) * 100 : null;
  if (margin === null) return netProfit > 0 ? "green" : "watch";
  return margin >= PROFIT_GREEN_MARGIN_PCT ? "green" : "watch";
}

// ---------------------------------------------------------------------------
// Debtors — recent / late / old
// ---------------------------------------------------------------------------
export type DebtorSplit = { recent: number; late: number; old: number; oldestOldDue: string | null };

export function splitDebtors(invoices: { AmountDue?: unknown; DueDate?: unknown; DueDateString?: unknown }[] | null | undefined, today: string): DebtorSplit {
  const t = dayNumber(today);
  let recent = 0, late = 0, old = 0;
  let oldestOldDue: string | null = null;
  for (const inv of invoices ?? []) {
    const due = parseAmount(inv.AmountDue as any);
    if (due <= 0) continue;
    const dueISO = xeroDateISO(inv.DueDateString) ?? xeroDateISO(inv.DueDate);
    const overdueDays = dueISO ? t - dayNumber(dueISO) : 0;
    if (overdueDays > RECENT_DEBTOR_DAYS) {
      old += due;
      if (dueISO && (!oldestOldDue || dueISO < oldestOldDue)) oldestOldDue = dueISO;
      continue;
    }
    recent += due;
    if (overdueDays > LATE_AFTER_DAYS) late += due;
  }
  return { recent, late, old, oldestOldDue };
}

export function payingOnTimeStatus(late: number, recent: number): CheckStatus {
  if (recent <= 0) return "green";
  if (late < LATE_AMOUNT_FLOOR) return "green";
  const share = (late / recent) * 100;
  if (share < LATE_SHARE_GREEN_PCT) return "green";
  if (share <= LATE_SHARE_WATCH_PCT) return "watch";
  return "red";
}

// ---------------------------------------------------------------------------
// Check 2 — Cash cover
// ---------------------------------------------------------------------------
export type AccountRef = { AccountID?: string; Name?: string; Class?: string; Type?: string };
export type MonthlyCosts = { months: number; average: number; wages: number; other: number };

const NON_CASH_NAME = /depreciat|amortis|amortiz/i;
const COST_SECTION = /cost of sales|cost of goods|direct cost|expense|overhead/i;
export const WAGE_NAME = /wage|salary|salaries|superannuation|payroll|staff|employee|contract\s*labou?r|sub[-\s]*contract|director'?s?\s*fee|payg|kiwisaver|bonus|commission/i;

export function normaliseName(n: string): string {
  return n.trim().toLowerCase();
}

/**
 * Average monthly cost of sales + operating expenses over the given monthly
 * P&L reports (each value column is one calendar month). Non-cash accounts
 * (depreciation/amortisation) are left out: by account type when the account
 * is known, otherwise by name.
 */
export function monthlyCosts(
  reports: ({ Rows?: Row[] } | null | undefined)[],
  accounts: AccountRef[] | null | undefined,
  wageNames: Set<string>,
): MonthlyCosts | null {
  const byId = new Map<string, AccountRef>();
  for (const a of accounts ?? []) if (a.AccountID) byId.set(a.AccountID, a);
  let months = 0, wages = 0, other = 0;
  for (const report of reports) {
    if (!report?.Rows) continue;
    const header = report.Rows.find((r) => r.RowType === "Header");
    const cols = Math.max(1, (header?.Cells?.length ?? 2) - 1);
    months += cols;
    const walk = (rows: Row[] | undefined, section: string) => {
      for (const r of rows ?? []) {
        if (r.RowType === "Section") { walk(r.Rows, r.Title || section); continue; }
        if (r.RowType !== "Row" || !r.Cells?.length) continue;
        const name = r.Cells[0]?.Value ?? "";
        const id = r.Cells[0]?.Attributes?.find((a) => a.Id === "account")?.Value;
        const acc = id ? byId.get(id) : undefined;
        let isCost: boolean;
        if (acc) isCost = String(acc.Class).toUpperCase() === "EXPENSE" && String(acc.Type).toUpperCase() !== "DEPRECIATN" && !NON_CASH_NAME.test(acc.Name ?? name);
        else isCost = !!id && COST_SECTION.test(section) && !NON_CASH_NAME.test(name);
        if (!isCost) continue;
        let amount = 0;
        for (let i = 1; i <= cols; i++) amount += parseAmount(r.Cells[i]?.Value);
        const n = acc?.Name ?? name;
        const isWage = wageNames.size > 0 ? wageNames.has(normaliseName(n)) : WAGE_NAME.test(n);
        if (isWage) wages += amount; else other += amount;
      }
    };
    walk(report.Rows, "");
  }
  if (months === 0) return null;
  return { months, average: (wages + other) / months, wages: wages / months, other: other / months };
}

export function cashCoverStatus(months: number | null): CheckStatus {
  if (months === null) return "na";
  if (months >= CASH_COVER_GREEN_MONTHS) return "green";
  if (months >= CASH_COVER_WATCH_MONTHS) return "watch";
  return "red";
}

// ---------------------------------------------------------------------------
// Info — next ATO payment
// ---------------------------------------------------------------------------
export type Cycle = "monthly" | "quarterly" | "annual" | "not_registered" | null | undefined;

/** Next standard ATO due date on or after `today` for a lodgement cycle. */
export function nextAtoDueDate(cycle: Cycle, today: string): string | null {
  const y = +today.slice(0, 4);
  const cands: string[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");
  if (cycle === "monthly") {
    for (let i = 0; i < 2; i++) {
      const d = new Date(Date.UTC(y, +today.slice(5, 7) - 1 + i, 21));
      cands.push(d.toISOString().slice(0, 10));
    }
  } else if (cycle === "quarterly") {
    for (const yy of [y, y + 1]) for (const m of [2, 4, 7, 10]) cands.push(`${yy}-${pad(m)}-28`);
  } else return null;
  return cands.sort().find((d) => d >= today) ?? null;
}

// ---------------------------------------------------------------------------
// The one builder
// ---------------------------------------------------------------------------
export type HealthInputs = {
  today: string;
  fyLabel: string;
  /** Year-to-date P&L and its actual dates. */
  pnlYtd: { report: { Rows?: Row[] } | null; from: string; to: string } | null;
  /** Cash at bank from `analyseBalanceSheet`; null when unreadable. */
  cashAtBank: number | null;
  invoices: any[] | null;
  monthly: MonthlyCosts | null;
  /** Amount owed to the ATO for GST/PAYG on the balance sheet; null when unknown. */
  atoOwed: number | null;
  gstCycle: Cycle;
  paygCycle: Cycle;
};

export function computeHealthChecks(input: HealthInputs): HealthChecks {
  const checks: HealthCheck[] = [];

  // 1. Making money?
  const profit = input.pnlYtd ? readProfitRows(input.pnlYtd.report) : { netProfit: null, revenue: null };
  const ytdDays = input.pnlYtd ? dayNumber(input.pnlYtd.to) - dayNumber(input.pnlYtd.from) + 1 : 0;
  const profitHeldBack = !!input.pnlYtd && ytdDays < PROFIT_MIN_DAYS;
  if (profit.netProfit === null) {
    checks.push({ key: "profit", question: "Making money?", figure: "Not available", detail: null, status: "na", meaning: "Xero's profit and loss for this year hasn't been saved yet." });
  } else {
    const np = profit.netProfit;
    const margin = profit.revenue && profit.revenue > 0 ? (np / profit.revenue) * 100 : null;
    const status = profitHeldBack ? "na" : profitStatus(np, profit.revenue);
    const figure = `${money(Math.abs(np))} ${np < 0 ? "loss" : "profit"} this year${margin === null ? "" : ` · ${margin.toFixed(1)}% margin`}`;
    const meaning = profitHeldBack
      ? "The financial year has only just started, so it's too early to call."
      : status === "green" ? "Profitable this financial year, with a healthy margin."
      : status === "watch" ? "Making a profit, but only a thin one."
      : "Spending more than is coming in this financial year.";
    checks.push({ key: "profit", question: "Making money?", figure, detail: null, status, meaning });
  }

  // 2. Cash cover
  const debtors = splitDebtors(input.invoices, input.today);
  const haveDebtors = input.invoices !== null;
  if (input.cashAtBank === null || !input.monthly || input.monthly.average <= 0) {
    checks.push({ key: "cash_cover", question: "Cash cover", figure: "Not available", detail: null, status: "na",
      meaning: input.cashAtBank === null ? "Cash at bank couldn't be read from the saved balance sheet." : "Monthly costs for the last three months aren't saved yet." });
  } else {
    const available = input.cashAtBank + (haveDebtors ? debtors.recent : 0);
    const months = available / input.monthly.average;
    const status = cashCoverStatus(months);
    const m = input.monthly;
    checks.push({
      key: "cash_cover",
      question: "Cash cover",
      figure: `${Math.max(0, months).toFixed(1)} months of costs`,
      detail: `Cash ${haveDebtors ? "+ recent debtors " : ""}${money(available)} against monthly costs of ~${money(m.average)} (wages ${money(m.wages)} · other ${money(m.other)})${m.months < 3 ? ` — average of ${m.months} month${m.months === 1 ? "" : "s"}` : ""}`,
      status,
      meaning: status === "green" ? "Enough cash and money coming in to cover a couple of months of costs."
        : status === "watch" ? "Cash would cover less than two months of normal costs."
        : "Cash would cover less than two weeks of normal costs.",
    });
  }

  // 3. Paying on time?
  if (!haveDebtors) {
    checks.push({ key: "paying_on_time", question: "Customers paying on time?", figure: "Not available", detail: null, status: "na", meaning: "The list of unpaid sales invoices hasn't been saved yet." });
  } else if (debtors.recent <= 0) {
    checks.push({ key: "paying_on_time", question: "Customers paying on time?", figure: "Nothing owing", detail: null, status: "green", meaning: "No recent sales invoices are waiting to be paid." });
  } else {
    const share = (debtors.late / debtors.recent) * 100;
    const status = payingOnTimeStatus(debtors.late, debtors.recent);
    checks.push({
      key: "paying_on_time",
      question: "Customers paying on time?",
      figure: `${share.toFixed(0)}% late`,
      detail: `${money(debtors.late)} more than ${LATE_AFTER_DAYS} days overdue, of ${money(debtors.recent)} owing from the last ${RECENT_DEBTOR_DAYS} days`,
      status,
      meaning: status === "green" ? "Most customers are paying on time."
        : status === "watch" ? "A fair share of recent invoices are running late — worth a follow-up."
        : "Most recent invoices are overdue — chase them up.",
    });
  }

  // Info lines (never counted)
  const info: HealthInfoLine[] = [];
  const gstDue = input.gstCycle && input.gstCycle !== "not_registered" ? nextAtoDueDate(input.gstCycle, input.today) : null;
  const paygDue = input.paygCycle && input.paygCycle !== "not_registered" ? nextAtoDueDate(input.paygCycle, input.today) : null;
  const nextDue = [gstDue, paygDue].filter((d): d is string => !!d).sort()[0] ?? null;
  if (nextDue) {
    info.push({
      key: "next_tax",
      text: input.atoOwed !== null && input.atoOwed > 0
        ? `Next tax payment: ~${money(input.atoOwed)} due ${dayLabel(nextDue)}`
        : `Next tax payment due ${dayLabel(nextDue)}`,
    });
  }
  if (haveDebtors && debtors.old > 0) {
    info.push({ key: "old_debts", text: `Old debts to review: ${money(debtors.old)}${debtors.oldestOldDue ? ` (oldest from ${monthYearLabel(debtors.oldestOldDue)})` : ""}` });
  }

  const counted = checks.filter((c) => c.status !== "na").length;
  const onTrack = checks.filter((c) => c.status === "green").length;
  return {
    asOf: input.today,
    fyLabel: input.fyLabel,
    headline: counted === 0 ? "Not enough saved figures yet" : `${onTrack} of ${counted} on track`,
    onTrack,
    counted,
    checks,
    info,
    profitHeldBack,
  };
}

export const STATUS_LABEL: Record<CheckStatus, string> = { green: "Green", watch: "Watch", red: "Red", na: "Not available" };
