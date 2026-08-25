// Monthly Management Report — computation. Server-only.
//
// Access-control invariants (section 0): every identifier from the request is a
// FILTER. The caller's access to the client is established before anything is
// computed, the tenant is resolved from the client server-side, and the service
// role is used ONLY to persist the snapshot afterwards (client_reports has no
// write policy).
//
// Xero call budget per generation:
//   1 × Reports/ProfitAndLoss (periods=11&timeframe=MONTH) — month, prior month,
//       FY YTD and the whole 12-month series
//   1 × Reports/ProfitAndLoss (prior financial year to date)
//   ≤5 pages × Invoices (ACCREC) and ≤5 pages × Invoices (ACCPAY)
// The aged-report endpoints are never called: they require a contactID, which
// means one request per contact.

import {
  MONTHLY_REPORT_PAYLOAD_VERSION,
  disclaimerText,
  addMonths,
  endOfMonth,
  fyLabelFor,
  fyStartFor,
  money,
  monthLabel,
  monthStartFor,
  pct,
  variancePct,
  type AgeingDetail,
  type AgeingRow,
  type FailedSection,
  type KeyFigure,
  type MonthlyReportPayload,
  type PnlLine,
  type PnlSectionPayload,
  type ReportNote,
} from "./monthly-report";
import * as pnlGrouping from "./pnl-grouping";

// ---------------------------------------------------------------------------
// Xero report parsing (multi-period aware)
// ---------------------------------------------------------------------------

type XeroCell = { Value?: string; Attributes?: { Id?: string; Value?: string }[] };
type XeroRow = {
  RowType: "Header" | "Section" | "Row" | "SummaryRow";
  Title?: string;
  Rows?: XeroRow[];
  Cells?: XeroCell[];
};

export type ParsedPeriod = { label: string; monthEnd: string; index: number };
export type ParsedRow = { name: string; values: number[]; accountId?: string | null };
export type ParsedSection = {
  title: string;
  kind: "revenue" | "other-income" | "cost-of-sales" | "expenses" | "summary" | "other";
  rows: ParsedRow[];
  totals: number[];
  /** Xero's own wording for the subtotal row, e.g. "Total Cost of Sales". Null when Xero gave none. */
  totalLabel: string | null;
};

export type ParsedPnl = { periods: ParsedPeriod[]; sections: ParsedSection[] };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function num(v: string | undefined): number {
  if (!v) return 0;
  const cleaned = v.replace(/,/g, "").replace(/\$/g, "").trim();
  const neg = /^\(.*\)$/.test(cleaned);
  const n = Number(neg ? cleaned.slice(1, -1) : cleaned);
  if (!Number.isFinite(n)) return 0;
  return neg ? -n : n;
}

/** Turn a Xero column heading into the month end it represents. */
export function headingToMonthEnd(label: string): string | null {
  const s = (label || "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) return endOfMonth(`${m[3]}-${String(mi + 1).padStart(2, "0")}-01`);
  }
  m = s.match(/^([A-Za-z]{3,})[-\s]+(\d{2}|\d{4})$/);
  if (m) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mi >= 0) {
      const yr = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
      return endOfMonth(`${yr}-${String(mi + 1).padStart(2, "0")}-01`);
    }
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return endOfMonth(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`,
    );
  }
  return null;
}

function classifySection(rawTitle: string): ParsedSection["kind"] {
  const t = (rawTitle || "").toLowerCase();
  if (t.includes("other income")) return "other-income";
  if (t.includes("cost of sales") || t.includes("direct cost")) return "cost-of-sales";
  if (t.includes("expense")) return "expenses";
  if (t.includes("gross profit") || t.includes("net profit") || t.includes("net loss")) return "summary";
  if (t.includes("income") || t.includes("revenue") || t.includes("sales")) return "revenue";
  return "other";
}

export function parsePnl(report: any, fallbackMonthEnd: string): ParsedPnl {
  const rows: XeroRow[] = report?.Rows ?? [];
  const header = rows.find((r) => r.RowType === "Header");
  const periods: ParsedPeriod[] = [];
  const cells = header?.Cells ?? [];
  for (let i = 1; i < cells.length; i++) {
    const label = cells[i]?.Value ?? "";
    const monthEnd = headingToMonthEnd(label) ?? (i === 1 ? fallbackMonthEnd : null);
    if (!monthEnd) continue;
    periods.push({ label: label || monthLabel(monthEnd), monthEnd, index: i });
  }
  if (!periods.length) {
    periods.push({ label: monthLabel(fallbackMonthEnd), monthEnd: fallbackMonthEnd, index: 1 });
  }

  const sections: ParsedSection[] = [];
  for (const section of rows) {
    if (section.RowType !== "Section") continue;
    const title = (section.Title || "").trim();
    const kind = classifySection(title);
    const lines: ParsedRow[] = [];
    let totals: number[] = periods.map(() => 0);
    let sawSummary = false;
    let totalLabel: string | null = null;
    for (const r of section.Rows ?? []) {
      if (!r.Cells || r.Cells.length < 2) continue;
      const name = (r.Cells[0]?.Value ?? "").trim();
      const values = periods.map((p) => num(r.Cells?.[p.index]?.Value));
      if (r.RowType === "Row") {
        // Xero tags the row's cells with the AccountID it came from; that is
        // how we later look the account's Type up.
        let accountId: string | null = null;
        for (const cell of r.Cells) {
          for (const a of cell.Attributes ?? []) {
            if (a?.Id === "account" && typeof a.Value === "string") accountId = a.Value;
          }
          if (accountId) break;
        }
        if (name) lines.push({ name, values, accountId });
      } else if (r.RowType === "SummaryRow") {
        totals = values;
        sawSummary = true;
        totalLabel = name || (title ? `Total ${title}` : null);

      }
    }
    if (!sawSummary) {
      totals = periods.map((_, i) => lines.reduce((s, l) => s + (l.values[i] ?? 0), 0));
    }
    sections.push({ title: title || "Unnamed", kind, rows: lines, totals, totalLabel });

  }
  return { periods, sections };
}

/** Merge several single-period P&L reports into one multi-column ParsedPnl.
 *  Xero only honours the organisation's own report layout on single-period
 *  requests: as soon as periods/timeframe are supplied it falls back to the
 *  standard layout ("Less Cost of Sales", one merged expense section). We
 *  therefore request each column separately and stitch them together here. */
export function mergeParsedPnl(
  parts: { label: string; monthEnd: string; parsed: ParsedPnl }[],
): ParsedPnl {
  const periods: ParsedPeriod[] = parts.map((p, i) => ({
    label: p.label,
    monthEnd: p.monthEnd,
    index: i + 1,
  }));
  const n = parts.length;
  const order: string[] = [];
  const byTitle = new Map<string, ParsedSection>();
  parts.forEach((part, col) => {
    for (const s of part.parsed.sections) {
      let target = byTitle.get(s.title);
      if (!target) {
        target = {
          title: s.title,
          kind: s.kind,
          rows: [],
          totals: new Array(n).fill(0),
          totalLabel: s.totalLabel,
        };
        byTitle.set(s.title, target);
        order.push(s.title);
      }
      if (!target.totalLabel && s.totalLabel) target.totalLabel = s.totalLabel;
      target.totals[col] = s.totals[0] ?? 0;
      for (const r of s.rows) {
        let row = target.rows.find((x) => x.name === r.name);
        if (!row) {
          row = { name: r.name, values: new Array(n).fill(0), accountId: r.accountId ?? null };
          target.rows.push(row);
        }
        if (!row.accountId && r.accountId) row.accountId = r.accountId;
        row.values[col] = r.values[0] ?? 0;
      }
    }
  });
  // Ordering must not depend on which column happened to mention a section or
  // an account first — the columns come back in different orders.
  const sections = order
    .map((t) => byTitle.get(t)!)
    .sort((a, b) => sectionRank(a) - sectionRank(b) || a.title.localeCompare(b.title));
  for (const s of sections) s.rows.sort((a, b) => a.name.localeCompare(b.name));
  return { periods, sections };
}

const KIND_RANK: Record<ParsedSection["kind"], number> = {
  revenue: 0,
  "cost-of-sales": 1,
  "other-income": 2,
  expenses: 3,
  other: 4,
  summary: 5,
};

function sectionRank(s: ParsedSection): number {
  return KIND_RANK[s.kind] ?? 4;
}

// ---------------------------------------------------------------------------
// Regrouping by account Type
// ---------------------------------------------------------------------------

/**
 * Rebuild the P&L sections from each account's Xero `Type`, because the API
 * sections come from the Report Code and can disagree with the organisation's
 * own report. Gross Profit, Net Profit and every subtotal are then derived
 * from the regrouped lines, not from Xero's section totals.
 *
 * Rows that cannot be matched to an account are NOT reassigned: they stay in a
 * clearly-labelled "Unmatched — <original section>" section so they remain
 * visible and still count towards the totals of the section Xero put them in.
 */
export function regroupByAccountType(
  parsed: ParsedPnl,
  accounts: import("./pnl-grouping").XeroAccountRef[],
): { parsed: ParsedPnl; unmatched: string[] } {
  const {
    indexAccounts,
    matchAccount,
    sectionForAccountType,
    SECTION_INCOME,
    SECTION_COST_OF_SALES,
    SECTION_OTHER_INCOME,
    SECTION_OPERATING_EXPENSES,
  } = pnlGrouping;
  const index = indexAccounts(accounts);
  const n = parsed.periods.length;
  const unmatched: string[] = [];
  const buckets = new Map<string, ParsedSection>();

  const bucket = (title: string, kind: ParsedSection["kind"]) => {
    let b = buckets.get(title);
    if (!b) {
      b = { title, kind, rows: [], totals: new Array(n).fill(0), totalLabel: `Total ${title}` };
      buckets.set(title, b);
    }
    return b;
  };

  for (const s of parsed.sections) {
    // Xero's own Gross Profit / Net Profit rows are discarded; they are
    // recomputed below from the regrouped lines.
    if (s.kind === "summary") continue;
    for (const r of s.rows) {
      const account = matchAccount(index, r);
      const target = account ? sectionForAccountType(account.type) : null;
      if (target) {
        bucket(target.title, target.kind as ParsedSection["kind"]).rows.push(r);
      } else {
        unmatched.push(r.name);
        bucket(`Unmatched — ${s.title}`, s.kind).rows.push(r);
      }
    }
  }

  for (const b of buckets.values()) {
    b.rows.sort((a, c) => a.name.localeCompare(c.name));
    b.totals = Array.from({ length: n }, (_, i) => b.rows.reduce((sum, r) => sum + (r.values[i] ?? 0), 0));
  }

  const pick = (title: string) => buckets.get(title) ?? null;
  const income = pick(SECTION_INCOME);
  const cos = pick(SECTION_COST_OF_SALES);
  const otherIncome = pick(SECTION_OTHER_INCOME);
  const opex = pick(SECTION_OPERATING_EXPENSES);
  const unmatchedSections = [...buckets.values()].filter((b) => b.title.startsWith("Unmatched — "));

  const zero = new Array(n).fill(0);
  const sum = (a: number[] | undefined, b: number[] | undefined, sign = 1) =>
    Array.from({ length: n }, (_, i) => (a?.[i] ?? 0) + sign * (b?.[i] ?? 0));

  const kindTotals = (kind: ParsedSection["kind"]) =>
    Array.from({ length: n }, (_, i) =>
      [...buckets.values()].filter((b) => b.kind === kind).reduce((s2, b) => s2 + (b.totals[i] ?? 0), 0),
    );

  const grossProfit = sum(kindTotals("revenue"), kindTotals("cost-of-sales"), -1);
  const netProfit = Array.from({ length: n }, (_, i) =>
    (grossProfit[i] ?? 0) + (kindTotals("other-income")[i] ?? 0) - (kindTotals("expenses")[i] ?? 0),
  );

  const summary = (title: string, totals: number[]): ParsedSection => ({
    title,
    kind: "summary",
    rows: [],
    totals,
    totalLabel: title,
  });

  const ordered: ParsedSection[] = [];
  if (income) ordered.push(income);
  if (cos) ordered.push(cos);
  ordered.push(summary("Gross Profit", grossProfit.length ? grossProfit : zero));
  if (otherIncome) ordered.push(otherIncome);
  if (opex) ordered.push(opex);
  ordered.push(...unmatchedSections.sort((a, b) => a.title.localeCompare(b.title)));
  ordered.push(summary("Net Profit", netProfit.length ? netProfit : zero));

  return { parsed: { periods: parsed.periods, sections: ordered }, unmatched };
}

export type PeriodTotals = {
  revenue: number;
  otherIncome: number;
  costOfSales: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  netMargin: number;
};

/** Definitions are fixed: "Expenses" EXCLUDES cost of sales, and net margin
 *  uses revenue INCLUDING other income. */
export function totalsForPeriod(parsed: ParsedPnl, i: number): PeriodTotals {
  let revenue = 0;
  let otherIncome = 0;
  let costOfSales = 0;
  let expenses = 0;
  for (const s of parsed.sections) {
    const v = s.totals[i] ?? 0;
    if (s.kind === "revenue") revenue += v;
    else if (s.kind === "other-income") otherIncome += v;
    else if (s.kind === "cost-of-sales") costOfSales += v;
    else if (s.kind === "expenses") expenses += v;
  }
  const grossProfit = revenue - costOfSales;
  const netProfit = grossProfit + otherIncome - expenses;
  const denominator = revenue + otherIncome;
  const netMargin = denominator === 0 ? 0 : (netProfit / denominator) * 100;
  return { revenue, otherIncome, costOfSales, grossProfit, expenses, netProfit, netMargin };
}

function sumTotals(list: PeriodTotals[]): PeriodTotals {
  const out: PeriodTotals = {
    revenue: 0,
    otherIncome: 0,
    costOfSales: 0,
    grossProfit: 0,
    expenses: 0,
    netProfit: 0,
    netMargin: 0,
  };
  for (const t of list) {
    out.revenue += t.revenue;
    out.otherIncome += t.otherIncome;
    out.costOfSales += t.costOfSales;
    out.grossProfit += t.grossProfit;
    out.expenses += t.expenses;
    out.netProfit += t.netProfit;
  }
  const denom = out.revenue + out.otherIncome;
  out.netMargin = denom === 0 ? 0 : (out.netProfit / denom) * 100;
  return out;
}

// ---------------------------------------------------------------------------
// Key figures
// ---------------------------------------------------------------------------

function sentenceFor(label: string, unit: "money" | "percent", month: number, prior: number): string {
  const fmt = (n: number) => (unit === "money" ? money(n) : pct(n));
  if (prior === month) return `${label} was unchanged at ${fmt(month)}.`;
  const up = month > prior;
  const delta = Math.abs(month - prior);
  const deltaText = unit === "money" ? money(delta) : `${delta.toFixed(1)} points`;
  return `${label} ${up ? "rose" : "fell"} to ${fmt(month)} for the month, ${up ? "up" : "down"} ${deltaText} on ${fmt(prior)} last month.`;
}

export function buildKeyFigures(
  month: PeriodTotals,
  priorMonth: PeriodTotals,
  fyYtd: PeriodTotals,
  priorFyYtd: PeriodTotals,
): KeyFigure[] {
  const defs: { key: KeyFigure["key"]; label: string; unit: KeyFigure["unit"]; pick: (t: PeriodTotals) => number }[] = [
    { key: "revenue", label: "Revenue", unit: "money", pick: (t) => t.revenue },
    { key: "expenses", label: "Expenses", unit: "money", pick: (t) => t.expenses },
    { key: "profit_after_tax", label: "Profit After Tax", unit: "money", pick: (t) => t.netProfit },
    { key: "net_margin", label: "Net Margin", unit: "percent", pick: (t) => t.netMargin },
  ];
  return defs.map((d) => {
    const m = d.pick(month);
    const pm = d.pick(priorMonth);
    const y = d.pick(fyYtd);
    const py = d.pick(priorFyYtd);
    return {
      key: d.key,
      label: d.label,
      unit: d.unit,
      month: m,
      priorMonth: pm,
      monthVariance: m - pm,
      monthVariancePct: d.unit === "percent" ? null : variancePct(m, pm),
      fyYtd: y,
      priorFyYtd: py,
      ytdVariance: y - py,
      ytdVariancePct: d.unit === "percent" ? null : variancePct(y, py),
      sentence: sentenceFor(d.label, d.unit, m, pm),
    };
  });
}

// ---------------------------------------------------------------------------
// Profit and Loss detail
// ---------------------------------------------------------------------------

export function buildPnlSection(
  parsed: ParsedPnl,
  monthIdx: number,
  priorIdx: number,
  fyIdxs: number[],
  labels: { month: string; priorMonth: string; fy: string },
): PnlSectionPayload {
  const lines: PnlLine[] = [];
  const fySum = (values: number[]) => fyIdxs.reduce((sum, i) => sum + (values[i] ?? 0), 0);
  for (const s of parsed.sections) {
    for (const r of s.rows) {
      const m = r.values[monthIdx] ?? 0;
      const p = priorIdx >= 0 ? (r.values[priorIdx] ?? 0) : 0;
      const fy = fySum(r.values);
      // Xero omits an account that is nil in every column; so do we.
      if (m === 0 && p === 0 && fy === 0) continue;
      lines.push({
        name: r.name,
        section: s.title,
        isTotal: false,
        month: m,
        priorMonth: p,
        variance: m - p,
        variancePct: variancePct(m, p),
        fyYtd: fy,
      });
    }
    // Only sections Xero actually subtotals get a subtotal row, and it carries
    // Xero's own wording ("Total Cost of Sales"). An unlabelled section — the
    // one holding Gross Profit / Net Profit — never produced "Total Unnamed".
    if (!s.totalLabel) continue;
    const tm = s.totals[monthIdx] ?? 0;
    const tp = priorIdx >= 0 ? (s.totals[priorIdx] ?? 0) : 0;
    lines.push({
      name: s.totalLabel,
      section: s.title,
      isTotal: true,
      month: tm,
      priorMonth: tp,
      variance: tm - tp,
      variancePct: variancePct(tm, tp),
      fyYtd: fySum(s.totals),
    });
  }

  const totals = totalsForPeriod(parsed, monthIdx);
  return {
    monthLabel: labels.month,
    priorMonthLabel: labels.priorMonth,
    fyLabel: labels.fy,
    lines,
    totals,
  };
}

// ---------------------------------------------------------------------------
// Ageing detail — reconstructed AS AT the period end by the shared subledger
// engine (src/lib/xero/asat-ledger.server.ts), the same one the Balance Sheet
// Reconciliation uses. `AmountDue` is never used: it is the balance now.
// ---------------------------------------------------------------------------

import type { AsAtEntry } from "@/lib/xero/asat-ledger.server";

export function bucketLabelsFor(periodEnd: string): string[] {
  const start = monthStartFor(periodEnd);
  return [
    "Current",
    monthLabel(addMonths(start, -1)),
    monthLabel(addMonths(start, -2)),
    monthLabel(addMonths(start, -3)),
    "Older",
  ];
}

/**
 * Buckets by DOCUMENT DATE relative to the period end, never relative to today.
 *
 * Xero's own aged reports (and the practice's management pack) age a document
 * from the date it was raised, not the date it falls due — an invoice dated in
 * June with July terms sits in June. Verified against Autotek NSW at
 * 31 July 2026: document date reproduces Xero's payables split exactly
 * (current 55,316.80 · Jun 14,910.00 · May 5,571.14 · older 38,512.31), while
 * due date collapsed 102,829.11 into Current.
 *
 * A document with no date at all cannot be aged, so it falls back to its due
 * date and then, failing that, to the period end (i.e. Current) — the least
 * alarming placement, and it is called out in the caveat.
 */
export function buildAgeing(entries: AsAtEntry[], periodEnd: string): AgeingDetail {
  const labels = bucketLabelsFor(periodEnd);
  const start = monthStartFor(periodEnd);
  const monthKeys = [start, addMonths(start, -1), addMonths(start, -2), addMonths(start, -3)].map(
    (s) => s.slice(0, 7),
  );
  const byContact = new Map<string, number[]>();
  for (const e of entries) {
    if (e.amount === 0) continue;
    const ageMonth = (e.date ?? e.dueDate ?? periodEnd).slice(0, 7);
    let bucket = 4; // Older
    if (ageMonth >= monthKeys[0]) bucket = 0;
    else if (ageMonth === monthKeys[1]) bucket = 1;
    else if (ageMonth === monthKeys[2]) bucket = 2;
    else if (ageMonth === monthKeys[3]) bucket = 3;

    const row = byContact.get(e.contact) ?? [0, 0, 0, 0, 0];
    row[bucket] += e.amount;
    byContact.set(e.contact, row);
  }
  const rows: AgeingRow[] = [...byContact.entries()]
    .map(([name, buckets]) => ({
      name,
      buckets: buckets.map((b) => Math.round(b * 100) / 100),
      total: Math.round(buckets.reduce((s, b) => s + b, 0) * 100) / 100,
      pctOfTotal: 0,
    }))
    .filter((r) => r.total !== 0 || r.buckets.some((b) => b !== 0))
    .sort((a, b) => b.total - a.total);
  const total = Math.round(rows.reduce((s, r) => s + r.total, 0) * 100) / 100;
  for (const r of rows) r.pctOfTotal = total === 0 ? 0 : (r.total / total) * 100;
  const totals = labels.map(
    (_, i) => Math.round(rows.reduce((s, r) => s + (r.buckets[i] ?? 0), 0) * 100) / 100,
  );
  return {
    asAt: periodEnd,
    bucketLabels: labels,
    rows,
    totals,
    total,
    caveat:
      "Reconstructed as at the period end: invoices dated on or before it, less payments and credit allocations dated on or before it. Payments made after the period end are excluded, so this ties to the balance sheet at that date. Documents are aged on the date they were raised, matching Xero's aged reports; a document with no date is shown as current.",

  };
}


// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function computeMonthlyReport(opts: {
  supabase: any;
  userId: string;
  clientId: string;
  tenantId: string;
  tenantName: string;
  clientName: string;
  organisationName: string;
  periodEnd: string;
  currency: string;
}): Promise<MonthlyReportPayload> {
  const { getConnectionByTenant, xeroGet } = await import("@/lib/xero/api.server");
  const conn = await getConnectionByTenant(opts.tenantId);
  const periodEnd = opts.periodEnd;
  const monthStart = monthStartFor(periodEnd);
  const fyStart = fyStartFor(periodEnd);
  const priorFyStart = addMonths(fyStart, -12);
  const priorFyPeriodEnd = endOfMonth(addMonths(monthStart, -12));

  const failed: FailedSection[] = [];
  let keyFigures: KeyFigure[] | null = null;
  let profitAndLoss: PnlSectionPayload | null = null;
  let receivables: AgeingDetail | null = null;
  let payables: AgeingDetail | null = null;
  let notes: ReportNote[] | null = null;

  // --- Profit and Loss (one call covers month, prior month, FY YTD, 12 months)
  // Both dates must be supplied and fromDate must precede toDate: with only
  // toDate, Xero defaults fromDate to the start of the CURRENT month, which is
  // after the period end for any past period (400 ValidationException).
  // periods=11&timeframe=MONTH then extends backwards from this month.
  const priorMonthEnd = endOfMonth(addMonths(monthStart, -1));
  const priorMonthStart = monthStartFor(priorMonthEnd);
  let parsed: ParsedPnl | null = null;

  // One request per column. standardLayout=false asks Xero for the
  // organisation's own report layout; a multi-period request (periods /
  // timeframe) silently ignores that and returns the standard layout.
  //
  // Requests are memoised on (fromDate, toDate) for the life of one
  // generation: when the period end IS the first month of the financial year,
  // the month column and the FY-to-date column ask Xero for exactly the same
  // window, and there is no reason to pay for it twice.
  const pnlCache = new Map<string, Promise<ParsedPnl>>();
  const fetchColumn = (fromDate: string, toDate: string): Promise<ParsedPnl> => {
    const key = `${fromDate}|${toDate}`;
    const hit = pnlCache.get(key);
    if (hit) return hit;
    const p = (async () => {
      const res = await xeroGet<{ Reports: any[] }>(conn, "Reports/ProfitAndLoss", {
        fromDate,
        toDate,
        standardLayout: "false",
      });
      const report = res.Reports?.[0];
      if (!report) throw new Error("Xero returned no Profit and Loss report.");
      return parsePnl(report, toDate);
    })();
    pnlCache.set(key, p);
    return p;
  };

  // The chart of accounts, read once per generation. Xero's P&L sections come
  // from each account's Report Code, but Xero's own layout groups by the
  // account's Type — so we need the Types to reproduce the client's report.
  let accountsPromise: Promise<pnlGrouping.XeroAccountRef[]> | null = null;
  const fetchAccounts = () => {
    if (!accountsPromise) {
      accountsPromise = (async () => {
        const res = await xeroGet<{ Accounts?: any[] }>(conn, "Accounts", {
          where: 'Class=="REVENUE"||Class=="EXPENSE"',
        });
        return (res.Accounts ?? []).map((a: any) => ({
          accountId: a.AccountID ?? null,
          code: a.Code ?? null,
          name: a.Name ?? "",
          type: a.Type ?? null,
        }));
      })();
    }
    return accountsPromise;
  };

  let unmatchedAccounts: string[] = [];
  const warnings: string[] = [];

  try {
    // SEQUENTIAL, deliberately. Xero allows only a handful of concurrent
    // requests per tenant; firing these together tripped the limit and failed
    // the whole report. A few extra seconds here costs nothing.
    const accounts = await fetchAccounts();
    const monthParsed = await fetchColumn(monthStart, periodEnd);
    const priorParsedCol = await fetchColumn(priorMonthStart, priorMonthEnd);
    const fyParsed = await fetchColumn(fyStart, periodEnd);

    const merged = mergeParsedPnl([
      { label: monthLabel(periodEnd), monthEnd: periodEnd, parsed: monthParsed },
      { label: monthLabel(priorMonthEnd), monthEnd: priorMonthEnd, parsed: priorParsedCol },
      { label: `${fyLabelFor(fyStart)} to date`, monthEnd: periodEnd, parsed: fyParsed },
    ]);
    const regrouped = regroupByAccountType(merged, accounts);
    parsed = regrouped.parsed;
    unmatchedAccounts = regrouped.unmatched;
    if (unmatchedAccounts.length) {
      // A note, not a failure. The lines are still presented (in the section Xero
      // returned) and the totals still tie, so the report must remain finalisable.
      warnings.push(
        `These Profit and Loss lines could not be matched to a Xero account, so they stayed in the section Xero returned: ${Array.from(new Set(unmatchedAccounts)).join(", ")}.`,
      );
    }
  } catch (e: any) {
    const message = e?.message ?? "Profit and Loss could not be read from Xero.";
    failed.push({ section: "profit_and_loss", message });
    failed.push({ section: "key_figures", message });
  }


  if (parsed) {
    // Columns are built in a fixed order: month, prior month, FY to date.
    const idx = 0;
    const priorEnd = priorMonthEnd;
    const priorIdx = 1;
    const fyIdxs = [2];

    const monthTotals = totalsForPeriod(parsed, idx);
    const priorTotals = priorIdx >= 0 ? totalsForPeriod(parsed, priorIdx) : sumTotals([]);
    const fyTotals = sumTotals(fyIdxs.map((i) => totalsForPeriod(parsed!, i)));

    // --- Prior financial year to date (the one extra call). Goes through the
    // same memoised fetcher, so an overlapping window is never requested twice.
    let priorFyTotals = sumTotals([]);
    try {
      const priorParsed = await fetchColumn(priorFyStart, priorFyPeriodEnd);
      // Regrouped the same way, so the comparative is like for like.
      const priorRegrouped = regroupByAccountType(priorParsed, await fetchAccounts());
      priorFyTotals = totalsForPeriod(priorRegrouped.parsed, 0);
    } catch (e: any) {
      failed.push({
        section: "key_figures",
        message: e?.message ?? "Prior financial year to date could not be read from Xero.",
      });
    }


    keyFigures = buildKeyFigures(monthTotals, priorTotals, fyTotals, priorFyTotals);
    profitAndLoss = buildPnlSection(parsed, idx, priorIdx, fyIdxs, {
      month: monthLabel(periodEnd),
      priorMonth: monthLabel(priorEnd),
      fy: `${fyLabelFor(fyStart)} to date`,
    });
  }

  // --- Receivables / payables detail, reconstructed as at the period end.
  const { fetchAsAtLedger } = await import("@/lib/xero/asat-ledger.server");
  try {
    const ledger = await fetchAsAtLedger(conn, periodEnd, "ACCREC");
    receivables = buildAgeing(ledger.entries, periodEnd);
  } catch (e: any) {
    failed.push({ section: "receivables", message: e?.message ?? "Receivables could not be read." });
  }

  try {
    const ledger = await fetchAsAtLedger(conn, periodEnd, "ACCPAY");
    payables = buildAgeing(ledger.entries, periodEnd);
  } catch (e: any) {
    failed.push({ section: "payables", message: e?.message ?? "Payables could not be read." });
  }


  // --- Notes (the client's existing notes, read under the caller's RLS)
  try {
    const { data: rows, error } = await opts.supabase
      .from("client_notes")
      .select("body, author_id, created_at")
      .eq("client_id", opts.clientId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.author_id).filter(Boolean)));
    let names = new Map<string, string>();
    if (ids.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, email")
        .in("id", ids as string[]);
      names = new Map(
        (profiles ?? []).map((p: any) => [p.id, p.display_name ?? p.email ?? "Unknown"]),
      );
    }
    notes = (rows ?? []).map((r: any) => ({
      body: r.body,
      author: names.get(r.author_id) ?? "Unknown",
      createdAt: r.created_at,
    }));
  } catch (e: any) {
    failed.push({ section: "notes", message: e?.message ?? "Notes could not be read." });
  }

  // De-duplicate failures per section (the P&L feeds two sections).
  const seen = new Set<string>();
  const failedSections = failed.filter((f) => {
    const k = `${f.section}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    payloadVersion: MONTHLY_REPORT_PAYLOAD_VERSION,
    complete: failedSections.length === 0,
    failedSections,
    warnings,
    meta: {
      organisationName: opts.organisationName,
      clientName: opts.clientName,
      tenantName: opts.tenantName,
      tenantId: opts.tenantId,
      periodEnd,
      monthStart,
      monthLabel: monthLabel(periodEnd),
      fyStart,
      fyLabel: fyLabelFor(fyStart),
      priorFyLabel: fyLabelFor(priorFyStart),
      currency: opts.currency,
      generatedAt: new Date().toISOString(),
    },
    keyFigures,
    profitAndLoss,
    receivables,
    payables,
    notes,
    // Frozen at generation time: an old report keeps the wording that was sent.
    disclaimer: disclaimerText(opts.clientName),
  };
}
