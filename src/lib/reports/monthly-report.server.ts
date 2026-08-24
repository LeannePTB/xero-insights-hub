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
  type IncomeVsExpenses,
  type KeyFigure,
  type MonthlyReportPayload,
  type PnlLine,
  type PnlSectionPayload,
  type ReportNote,
} from "./monthly-report";

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
export type ParsedSection = {
  title: string;
  kind: "revenue" | "other-income" | "cost-of-sales" | "expenses" | "summary" | "other";
  rows: { name: string; values: number[] }[];
  totals: number[];
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
    const lines: { name: string; values: number[] }[] = [];
    let totals: number[] = periods.map(() => 0);
    let sawSummary = false;
    for (const r of section.Rows ?? []) {
      if (!r.Cells || r.Cells.length < 2) continue;
      const name = (r.Cells[0]?.Value ?? "").trim();
      const values = periods.map((p) => num(r.Cells?.[p.index]?.Value));
      if (r.RowType === "Row") {
        if (name) lines.push({ name, values });
      } else if (r.RowType === "SummaryRow") {
        totals = values;
        sawSummary = true;
        if (!lines.length && name) lines.push({ name, values });
      }
    }
    if (!sawSummary) {
      totals = periods.map((_, i) => lines.reduce((s, l) => s + (l.values[i] ?? 0), 0));
    }
    sections.push({ title: title || "Unnamed", kind, rows: lines, totals });
  }
  return { periods, sections };
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
  for (const s of parsed.sections) {
    for (const r of s.rows) {
      const m = r.values[monthIdx] ?? 0;
      const p = priorIdx >= 0 ? (r.values[priorIdx] ?? 0) : 0;
      lines.push({
        name: r.name,
        section: s.title,
        isTotal: false,
        month: m,
        priorMonth: p,
        variance: m - p,
        variancePct: variancePct(m, p),
        fyYtd: fyIdxs.reduce((sum, i) => sum + (r.values[i] ?? 0), 0),
      });
    }
    const tm = s.totals[monthIdx] ?? 0;
    const tp = priorIdx >= 0 ? (s.totals[priorIdx] ?? 0) : 0;
    lines.push({
      name: `Total ${s.title}`,
      section: s.title,
      isTotal: true,
      month: tm,
      priorMonth: tp,
      variance: tm - tp,
      variancePct: variancePct(tm, tp),
      fyYtd: fyIdxs.reduce((sum, i) => sum + (s.totals[i] ?? 0), 0),
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
// Income vs Expenses (12 months)
// ---------------------------------------------------------------------------

export function buildIncomeVsExpenses(parsed: ParsedPnl): IncomeVsExpenses {
  const ordered = [...parsed.periods].sort((a, b) => a.monthEnd.localeCompare(b.monthEnd));
  const months = ordered.map((p) => {
    const idx = parsed.periods.indexOf(p);
    const t = totalsForPeriod(parsed, idx);
    return {
      label: monthLabel(p.monthEnd),
      monthEnd: p.monthEnd,
      income: t.revenue + t.otherIncome,
      expenses: t.costOfSales + t.expenses,
    };
  });
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);
  const n = months.length || 1;
  const best = months.reduce<null | { label: string; income: number }>(
    (b, m) => (!b || m.income > b.income ? { label: m.label, income: m.income } : b),
    null,
  );
  const worst = months.reduce<null | { label: string; income: number }>(
    (b, m) => (!b || m.income < b.income ? { label: m.label, income: m.income } : b),
    null,
  );
  const sentence =
    `Over the last ${n} month${n === 1 ? "" : "s"}, income totalled ${money(totalIncome)} ` +
    `against ${money(totalExpenses)} of income and expenses, an average of ${money(totalIncome / n)} ` +
    `income and ${money(totalExpenses / n)} costs a month.` +
    (best && worst ? ` The strongest month was ${best.label} (${money(best.income)}) and the weakest was ${worst.label} (${money(worst.income)}).` : "");
  return {
    months,
    narrative: {
      totalIncome,
      totalExpenses,
      averageIncome: totalIncome / n,
      averageExpenses: totalExpenses / n,
      bestMonth: best,
      worstMonth: worst,
      sentence,
    },
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

/** Buckets by due date RELATIVE TO THE PERIOD END, never relative to today. */
export function buildAgeing(entries: AsAtEntry[], periodEnd: string): AgeingDetail {
  const labels = bucketLabelsFor(periodEnd);
  const start = monthStartFor(periodEnd);
  const monthKeys = [start, addMonths(start, -1), addMonths(start, -2), addMonths(start, -3)].map(
    (s) => s.slice(0, 7),
  );
  const byContact = new Map<string, number[]>();
  for (const e of entries) {
    if (e.amount === 0) continue;
    const dueMonth = (e.dueDate ?? e.date ?? periodEnd).slice(0, 7);
    let bucket = 4; // Older
    if (dueMonth >= monthKeys[0]) bucket = 0;
    else if (dueMonth === monthKeys[1]) bucket = 1;
    else if (dueMonth === monthKeys[2]) bucket = 2;
    else if (dueMonth === monthKeys[3]) bucket = 3;
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
      "Reconstructed as at the period end: invoices dated on or before it, less payments and credit allocations dated on or before it. Payments made after the period end are excluded, so this ties to the balance sheet at that date.",
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
  let incomeVsExpenses: IncomeVsExpenses | null = null;
  let receivables: AgeingDetail | null = null;
  let payables: AgeingDetail | null = null;
  let notes: ReportNote[] | null = null;

  // --- Profit and Loss (one call covers month, prior month, FY YTD, 12 months)
  // Both dates must be supplied and fromDate must precede toDate: with only
  // toDate, Xero defaults fromDate to the start of the CURRENT month, which is
  // after the period end for any past period (400 ValidationException).
  // periods=11&timeframe=MONTH then extends backwards from this month.
  let parsed: ParsedPnl | null = null;
  try {
    const res = await xeroGet<{ Reports: any[] }>(conn, "Reports/ProfitAndLoss", {
      fromDate: monthStart,
      toDate: periodEnd,
      periods: "11",
      timeframe: "MONTH",
    });

    const report = res.Reports?.[0];
    if (!report) throw new Error("Xero returned no Profit and Loss report.");
    parsed = parsePnl(report, periodEnd);
  } catch (e: any) {
    const message = e?.message ?? "Profit and Loss could not be read from Xero.";
    failed.push({ section: "profit_and_loss", message });
    failed.push({ section: "key_figures", message });
    failed.push({ section: "income_vs_expenses", message });
  }

  if (parsed) {
    const monthIdx = parsed.periods.findIndex((p) => p.monthEnd === periodEnd);
    const idx = monthIdx >= 0 ? monthIdx : 0;
    const priorEnd = endOfMonth(addMonths(monthStart, -1));
    const priorIdx = parsed.periods.findIndex((p) => p.monthEnd === priorEnd);
    const fyIdxs = parsed.periods
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.monthEnd >= fyStart && p.monthEnd <= periodEnd)
      .map(({ i }) => i);

    const monthTotals = totalsForPeriod(parsed, idx);
    const priorTotals = priorIdx >= 0 ? totalsForPeriod(parsed, priorIdx) : sumTotals([]);
    const fyTotals = sumTotals(fyIdxs.map((i) => totalsForPeriod(parsed!, i)));

    // --- Prior financial year to date (the one extra call)
    let priorFyTotals = sumTotals([]);
    try {
      const res = await xeroGet<{ Reports: any[] }>(conn, "Reports/ProfitAndLoss", {
        fromDate: priorFyStart,
        toDate: priorFyPeriodEnd,
      });
      const report = res.Reports?.[0];
      if (!report) throw new Error("Xero returned no prior year Profit and Loss report.");
      const priorParsed = parsePnl(report, priorFyPeriodEnd);
      priorFyTotals = totalsForPeriod(priorParsed, 0);
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
    incomeVsExpenses = buildIncomeVsExpenses(parsed);
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

  // De-duplicate failures per section (the P&L feeds three sections).
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
    incomeVsExpenses,
    receivables,
    payables,
    notes,
  };
}
