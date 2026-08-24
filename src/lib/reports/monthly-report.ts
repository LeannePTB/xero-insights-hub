// Monthly Management Report — shared types, payload version and formatting.
// Client-safe: no server-only imports.
//
// BUMP MONTHLY_REPORT_PAYLOAD_VERSION whenever the calculation or the payload
// shape changes. A stored DRAFT written by an older version is superseded and
// recomputed; a `final` or `sent` report is never recomputed or overwritten.

export const MONTHLY_REPORT_KEY = "monthly_management";
// v2: P&L date parameters fixed; ageing reconstructed as at the period end via
// the shared as-at subledger engine instead of the live AmountDue.
export const MONTHLY_REPORT_PAYLOAD_VERSION = 2;

export type ReportStatus = "draft" | "final" | "sent";

export type FailedSection = { section: string; message: string };

export type KeyFigure = {
  key: "revenue" | "expenses" | "profit_after_tax" | "net_margin";
  label: string;
  /** Percentages are stored as percentages (e.g. -27.1), money in dollars. */
  unit: "money" | "percent";
  month: number;
  priorMonth: number;
  monthVariance: number;
  monthVariancePct: number | null;
  fyYtd: number;
  priorFyYtd: number;
  ytdVariance: number;
  ytdVariancePct: number | null;
  sentence: string;
};

export type PnlLine = {
  name: string;
  section: string;
  isTotal: boolean;
  month: number;
  priorMonth: number;
  variance: number;
  variancePct: number | null;
  fyYtd: number;
};

export type PnlSectionPayload = {
  monthLabel: string;
  priorMonthLabel: string;
  fyLabel: string;
  lines: PnlLine[];
  /** Headline totals for the month, for cross-checking against Key figures. */
  totals: {
    revenue: number;
    otherIncome: number;
    costOfSales: number;
    grossProfit: number;
    expenses: number;
    netProfit: number;
    netMargin: number;
  };
};

export type MonthPoint = { label: string; monthEnd: string; income: number; expenses: number };

export type IncomeVsExpenses = {
  months: MonthPoint[];
  narrative: {
    totalIncome: number;
    totalExpenses: number;
    averageIncome: number;
    averageExpenses: number;
    bestMonth: { label: string; income: number } | null;
    worstMonth: { label: string; income: number } | null;
    sentence: string;
  };
};

export type AgeingRow = {
  name: string;
  buckets: number[];
  total: number;
  pctOfTotal: number;
};

export type AgeingDetail = {
  asAt: string;
  bucketLabels: string[];
  rows: AgeingRow[];
  totals: number[];
  total: number;
  /** Ageing is derived from the invoices still outstanding when generated. */
  caveat: string;
};

export type ReportNote = { body: string; author: string; createdAt: string };

export type MonthlyReportPayload = {
  payloadVersion: number;
  complete: boolean;
  failedSections: FailedSection[];
  meta: {
    organisationName: string;
    clientName: string;
    tenantName: string;
    tenantId: string;
    periodEnd: string;
    monthStart: string;
    monthLabel: string;
    fyStart: string;
    fyLabel: string;
    priorFyLabel: string;
    currency: string;
    generatedAt: string;
  };
  keyFigures: KeyFigure[] | null;
  profitAndLoss: PnlSectionPayload | null;
  incomeVsExpenses: IncomeVsExpenses | null;
  receivables: AgeingDetail | null;
  payables: AgeingDetail | null;
  notes: ReportNote[] | null;
};

export const SECTION_LABELS: Record<string, string> = {
  key_figures: "Key figures",
  profit_and_loss: "Profit and Loss",
  income_vs_expenses: "Income vs Expenses",
  receivables: "Receivables detail",
  payables: "Payables detail",
  notes: "Notes",
};

/** AUD, brackets for negatives, no cents by default. */
export function money(n: number | null | undefined, opts: { cents?: boolean; currency?: string } = {}) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const digits = opts.cents ? 2 : 0;
  const abs = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: opts.currency ?? "AUD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(n));
  return n < 0 ? `(${abs})` : abs;
}

export function pct(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const s = `${Math.abs(n).toFixed(digits)}%`;
  return n < 0 ? `(${s})` : s;
}

/** Australian financial year: 1 July – 30 June. */
export function fyStartFor(periodEnd: string): string {
  const [y, m] = periodEnd.split("-").map(Number);
  const startYear = m >= 7 ? y : y - 1;
  return `${startYear}-07-01`;
}

export function fyLabelFor(fyStart: string): string {
  const y = Number(fyStart.slice(0, 4));
  return `FY${String(y + 1).slice(2)}`;
}

export function monthStartFor(periodEnd: string): string {
  return `${periodEnd.slice(0, 7)}-01`;
}

export function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-AU", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function addMonths(iso: string, delta: number): string {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function endOfMonth(monthStartIso: string): string {
  const [y, m] = monthStartIso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function variancePct(current: number, prior: number): number | null {
  if (!Number.isFinite(prior) || prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}
