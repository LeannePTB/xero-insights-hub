// Monthly Management Report — shared types, payload version and formatting.
// Client-safe: no server-only imports.
//
// BUMP MONTHLY_REPORT_PAYLOAD_VERSION whenever the calculation or the payload
// shape changes. A stored DRAFT written by an older version is superseded and
// recomputed; a `final` or `sent` report is never recomputed or overwritten.

export const MONTHLY_REPORT_KEY = "monthly_management";
// v2: P&L date parameters fixed; ageing reconstructed as at the period end via
// the shared as-at subledger engine instead of the live AmountDue.
// v3: the as-at subledger is narrowed in Xero with a `where` clause so only
// documents open at the period end are fetched — v2 payloads tripped the paging
// cap on large files and reported the ageing sections as failed.
// v4: the rendered disclaimer text is frozen into the payload at generation
// time, so an old report always shows the wording that was actually sent.
export const MONTHLY_REPORT_PAYLOAD_VERSION = 7;

// v6: ageing buckets on the document date (matching Xero's aged reports);
// P&L subtotals carry Xero's own wording; nil accounts suppressed.

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
  receivables: AgeingDetail | null;
  payables: AgeingDetail | null;
  notes: ReportNote[] | null;
  /**
   * Verbatim legal wording, rendered with the client name at generation time
   * and frozen here. Absent on payloads written before v4 — callers fall back
   * to `disclaimerText(clientName)`.
   */
  disclaimer?: string;
};

/**
 * Filters out failures naming sections that no longer exist (payloads written
 * before v5 can still name `income_vs_expenses`).
 */
export function renderableFailedSections(payload: { failedSections: FailedSection[] }) {
  return payload.failedSections.filter((f) => f.section in SECTION_LABELS);
}

/**
 * True when a generation failed because Xero throttled us, rather than because
 * of missing data or permissions. Worth telling apart: the remedy is simply to
 * wait a moment and generate again.
 */
export function wasRateLimited(payload: { failedSections: FailedSection[] } | null | undefined) {
  return (payload?.failedSections ?? []).some((f) =>
    /Xero has paused requests for this organisation/i.test(f.message ?? ""),
  );
}


export const SECTION_LABELS: Record<string, string> = {
  key_figures: "Key figures",
  profit_and_loss: "Profit and Loss",
  receivables: "Receivables detail",
  payables: "Payables detail",
  notes: "Notes",
};

/**
 * Verbatim legal wording — do not reword, shorten or reformat. Only the client
 * name (the entity the report is about) is substituted.
 */
export function disclaimerText(clientName: string) {
  return `This report is prepared solely for the confidential use of ${clientName}. In the preparation of this report we have relied upon the unaudited financial and non-financial information available for the entity. We have not audited the information contained in this report and therefore do not express an opinion or any other form of assurance on the accuracy of the information presented. No party shall be liable for any loss, damage or expense which may be caused to another party by relying on this report.`;
}

/** Stored wording when present, otherwise the current wording. */
export function resolveDisclaimer(payload: MonthlyReportPayload) {
  const stored = payload.disclaimer?.trim();
  return stored && stored.length > 0 ? stored : disclaimerText(payload.meta.clientName);
}


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

/** Magnitude only — for a percentage already inside brackets. */
export function pctMagnitude(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "\u2014";
  return `${Math.abs(n).toFixed(digits)}%`;
}

/** Australian financial year: 1 July – 30 June. */
export function fyStartFor(periodEnd: string): string {
  const [y, m] = periodEnd.split("-").map(Number);
  const startYear = m >= 7 ? y : y - 1;
  return `${startYear}-07-01`;
}

/** Case- and whitespace-insensitive name comparison for de-duplication. */
function normaliseName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function namesEqual(a: string, b: string) {
  return normaliseName(a) === normaliseName(b);
}

/** Return the input names with later duplicates (case-insensitive) removed. */
export function uniqueNames(names: string[]) {
  const seen = new Set<string>();
  return names.filter((n) => {
    const key = normaliseName(n);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
