import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type XeroReportRow = {
  RowType: "Header" | "Section" | "Row" | "SummaryRow";
  Title?: string;
  Rows?: XeroReportRow[];
  Cells?: { Value: string }[];
};

export type PnlReport = {
  reportName: string;
  reportDate: string;
  fromDate?: string;
  toDate?: string;
  totalIncome: number;
  totalCostOfSales: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  incomeLines: { name: string; amount: number }[];
  expenseLines: { name: string; amount: number }[];
  cogsLines: { name: string; amount: number }[];
};

function parseAmount(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function summarise(report: any): PnlReport {
  const out: PnlReport = {
    reportName: report?.ReportName ?? "Profit and Loss",
    reportDate: report?.ReportDate ?? "",
    fromDate: report?.ReportTitles?.[2],
    toDate: report?.ReportTitles?.[3],
    totalIncome: 0,
    totalCostOfSales: 0,
    grossProfit: 0,
    totalExpenses: 0,
    netProfit: 0,
    incomeLines: [],
    expenseLines: [],
    cogsLines: [],
  };

  const sections: XeroReportRow[] = report?.Rows ?? [];
  for (const section of sections) {
    if (section.RowType !== "Section") continue;
    const title = (section.Title || "").toLowerCase();
    const rows = section.Rows ?? [];
    const lineItems: { name: string; amount: number }[] = [];
    let sectionTotal = 0;
    for (const r of rows) {
      if (r.RowType === "Row" && r.Cells && r.Cells.length >= 2) {
        const name = r.Cells[0].Value;
        const amount = parseAmount(r.Cells[1].Value);
        if (name) lineItems.push({ name, amount });
      } else if (r.RowType === "SummaryRow" && r.Cells && r.Cells.length >= 2) {
        sectionTotal = parseAmount(r.Cells[1].Value);
      }
    }
    if (title.includes("income") || title.includes("revenue") || title === "trading income") {
      out.totalIncome += sectionTotal;
      out.incomeLines.push(...lineItems);
    } else if (title.includes("cost of sales")) {
      out.totalCostOfSales += sectionTotal;
      out.cogsLines.push(...lineItems);
    } else if (title === "gross profit") {
      out.grossProfit = sectionTotal;
    } else if (title.includes("less operating expenses") || title.includes("expenses")) {
      out.totalExpenses += sectionTotal;
      out.expenseLines.push(...lineItems);
    } else if (title.includes("net profit") || title.includes("net loss")) {
      out.netProfit = sectionTotal;
    }
  }

  if (!out.grossProfit) out.grossProfit = out.totalIncome - out.totalCostOfSales;
  if (!out.netProfit) out.netProfit = out.grossProfit - out.totalExpenses;
  // Sort line items descending
  out.expenseLines.sort((a, b) => b.amount - a.amount);
  out.incomeLines.sort((a, b) => b.amount - a.amount);
  return out;
}

export const getProfitAndLoss = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      fromDate?: string;
      toDate?: string;
      widget?: "pnl" | "period_performance" | "accounting_breakeven" | "true_breakeven";
      basis?: "accrual" | "cash";
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const { assertWidgetAccess, getClientReportBasis } = await import("./access.server");
    await assertWidgetAccess(context.userId, data.tenantId, data.widget ?? "pnl");
    const conn = await getConnectionByTenant(data.tenantId);
    const basis = data.basis ?? (await getClientReportBasis(data.tenantId));
    const res = await xeroGet<{ Reports: any[] }>(conn, "Reports/ProfitAndLoss", {
      fromDate: data.fromDate,
      toDate: data.toDate,
      ...(basis === "cash" ? { paymentsOnly: "true" } : {}),
    });
    const report = res.Reports?.[0];
    if (!report) throw new Error("No P&L report returned by Xero.");
    return { ...summarise(report), basis };
  });

export type TaxLiabilities = {
  reportDate: string;
  asAtDate?: string;
  gst: number;
  payg: number;
  superannuation: number;
  totalTaxLiability: number;
  lines: { name: string; amount: number; category: "gst" | "payg" | "super" | "other-tax" }[];
  mode?: "balance" | "movement";
};

function classifyTaxLine(name: string): TaxLiabilities["lines"][number]["category"] | null {
  const n = name.toLowerCase();
  if (n.includes("gst") || n.includes("vat") || n.includes("sales tax")) return "gst";
  if (n.includes("payg") || n.includes("paye") || n.includes("withholding")) return "payg";
  if (n.includes("super")) return "super";
  if (n.includes("tax payable") || n.includes("income tax") || n.includes("bas")) return "other-tax";
  return null;
}

function walkRows(rows: XeroReportRow[] | undefined, visit: (r: XeroReportRow) => void) {
  if (!rows) return;
  for (const r of rows) {
    visit(r);
    if (r.Rows) walkRows(r.Rows, visit);
  }
}

function extractTaxLines(report: any) {
  const lines: (TaxLiabilities["lines"][number] & { accountId?: string })[] = [];
  walkRows(report?.Rows, (r) => {
    if (r.RowType !== "Row" || !r.Cells || r.Cells.length < 2) return;
    const name = r.Cells[0].Value;
    if (!name) return;
    const category = classifyTaxLine(name);
    if (!category) return;
    const amount = parseAmount(r.Cells[1].Value);
    let accountId: string | undefined;
    for (const cell of r.Cells) {
      const attrs = (cell as any).Attributes;
      if (!Array.isArray(attrs)) continue;
      for (const a of attrs) {
        if (a?.Id === "account" && typeof a.Value === "string") accountId = a.Value;
      }
      if (accountId) break;
    }
    lines.push({ name, amount, category, accountId });
  });
  return lines;
}

function isoDayBefore(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export const getTaxLiabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { tenantId: string; date?: string; fromDate?: string; mode?: "balance" | "movement" }) => input,
  )
  .handler(async ({ data, context }) => {
    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const { assertWidgetAccess } = await import("./access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "tax_liability");
    const conn = await getConnectionByTenant(data.tenantId);
    const mode = data.mode ?? "balance";

    const res = await xeroGet<{ Reports: any[] }>(conn, "Reports/BalanceSheet", { date: data.date });
    const report = res.Reports?.[0];
    if (!report) throw new Error("No Balance Sheet returned by Xero.");
    const endLines = extractTaxLines(report);

    let lines = endLines;
    if (mode === "movement" && data.fromDate) {
      const openingDate = isoDayBefore(data.fromDate);
      const openRes = await xeroGet<{ Reports: any[] }>(conn, "Reports/BalanceSheet", { date: openingDate });
      const openReport = openRes.Reports?.[0];
      const openLines = openReport ? extractTaxLines(openReport) : [];
      const openMap = new Map<string, number>();
      for (const l of openLines) openMap.set(l.name, (openMap.get(l.name) ?? 0) + l.amount);
      const seen = new Set<string>();
      const movement: TaxLiabilities["lines"] = [];
      for (const l of endLines) {
        seen.add(l.name);
        const delta = l.amount - (openMap.get(l.name) ?? 0);
        if (delta !== 0) movement.push({ name: l.name, amount: delta, category: l.category });
      }
      for (const l of openLines) {
        if (seen.has(l.name)) continue;
        const delta = -l.amount;
        if (delta !== 0) movement.push({ name: l.name, amount: delta, category: l.category });
      }
      lines = movement;
    }

    const out: TaxLiabilities = {
      reportDate: report.ReportDate ?? "",
      asAtDate: report.ReportTitles?.[2] ?? report.ReportTitles?.[1],
      gst: 0,
      payg: 0,
      superannuation: 0,
      totalTaxLiability: 0,
      lines,
      mode,
    };
    for (const l of lines) {
      if (l.category === "gst") out.gst += l.amount;
      else if (l.category === "payg") out.payg += l.amount;
      else if (l.category === "super") out.superannuation += l.amount;
    }
    out.totalTaxLiability = lines.reduce((s, l) => s + l.amount, 0);
    out.lines.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    return out;
  });

// ============================================================================
// AU Activity Statement (BAS) – pulls directly from Xero so values match the PDF
// ============================================================================

export type ActivityStatement = {
  periodFrom?: string;
  periodTo?: string;
  reportName: string;
  basis?: "cash" | "accrual" | string;
  boxes: Record<string, number>; // keyed by box code: G1, 1A, 1B, W1, W2, W3, W4, W5, 8A, 8B, 9
  lines: { code: string; label: string; amount: number }[];
  netGst: number;          // 1A - 1B (positive => payable, negative => refund)
  netPayment: number;      // line 9 if present, else 1A + W5 - 1B
  available: boolean;      // false when org has no AU Activity Statement
  message?: string;
};

const BOX_CODE_REGEX = /^(G\d+[A-Z]?|W\d+|T\d+|[1-9][A-Z]?|[1-9])$/;
const BOX_CODE_INLINE_REGEX = /\b(G\d+[A-Z]?|W\d+|T\d+|[1-9][A-Z]?)\b/;

function normaliseCode(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const cleaned = s.trim().replace(/[():]/g, "").trim();
  return BOX_CODE_REGEX.test(cleaned) ? cleaned : undefined;
}

function parseMoney(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[A-Z$\s,]/gi, "")
    .replace(/^\((.*)\)$/, "-$1");
  if (!/\d/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractBoxes(report: any): {
  boxes: Record<string, number>;
  lines: ActivityStatement["lines"];
  unmatchedLabels: string[];
} {
  const boxes: Record<string, number> = {};
  const lines: ActivityStatement["lines"] = [];
  const unmatchedLabels: string[] = [];
  walkRows(report?.Rows, (r) => {
    if ((r.RowType !== "Row" && r.RowType !== "SummaryRow") || !r.Cells) return;
    const cells = r.Cells;
    if (cells.length < 2) return;
    let code: string | undefined;
    let label: string | undefined;
    for (let i = 0; i < Math.min(3, cells.length); i++) {
      const v = (cells[i]?.Value ?? "").toString().trim();
      const norm = normaliseCode(v);
      if (norm && !code) code = norm;
      else if (v && !label) label = v;
    }
    if (!code && label) {
      const m = label.match(BOX_CODE_INLINE_REGEX);
      if (m) code = m[1];
    }
    let amount: number | null = null;
    for (let i = cells.length - 1; i >= 0; i--) {
      const raw = (cells[i]?.Value ?? "").toString();
      const n = parseMoney(raw);
      if (n !== null) {
        amount = n;
        break;
      }
    }
    if (!code) {
      if (label && amount !== null) unmatchedLabels.push(`${label} = ${amount}`);
      return;
    }
    boxes[code] = amount ?? 0;
    lines.push({ code, label: label ?? code, amount: amount ?? 0 });
  });
  return { boxes, lines, unmatchedLabels };
}

export const getActivityStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; fromDate: string; toDate: string }) => input)
  .handler(async ({ data, context }): Promise<ActivityStatement> => {
    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const { assertWidgetAccess } = await import("./access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "tax_liability");
    const conn = await getConnectionByTenant(data.tenantId);

    // Xero AU Activity Statement endpoint. Returns 404 / NotFound for non-AU orgs.
    let res: { Reports: any[] } | null = null;
    try {
      res = await xeroGet<{ Reports: any[] }>(conn, "Reports/ActivityStatement", {
        fromDate: data.fromDate,
        toDate: data.toDate,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/404|NotFound|not available|not found/i.test(msg)) {
        return {
          reportName: "Activity Statement",
          boxes: {},
          lines: [],
          netGst: 0,
          netPayment: 0,
          available: false,
          message: "Activity Statement isn't available for this Xero organisation (AU GST orgs only).",
        };
      }
      throw e;
    }

    const report = res?.Reports?.[0];
    if (!report) {
      return {
        reportName: "Activity Statement",
        boxes: {},
        lines: [],
        netGst: 0,
        netPayment: 0,
        available: false,
        message: "No Activity Statement returned by Xero for this period.",
      };
    }

    const { boxes, lines } = extractBoxes(report);
    const get = (k: string) => boxes[k] ?? 0;
    const netGst = get("1A") - get("1B");
    const w5 = get("W5") || get("W2") + get("W3") + get("W4");
    const netPayment = get("9") !== 0 ? get("9") : get("1A") + w5 - get("1B");

    // basis: look for "Cash" / "Accrual" in ReportTitles
    const titles: string[] = report.ReportTitles ?? [];
    const basis =
      titles.some((t) => /cash/i.test(t)) ? "cash" :
      titles.some((t) => /accrual/i.test(t)) ? "accrual" : undefined;

    return {
      reportName: report.ReportName ?? "Activity Statement",
      periodFrom: data.fromDate,
      periodTo: data.toDate,
      basis,
      boxes,
      lines,
      netGst,
      netPayment,
      available: true,
    };
  });

// ============================================================================
// Activity statement for a period. Exact BAS boxes require Xero Activity Statement access.
// ============================================================================

export type ActivityStatementPeriod = {
  source: "activity-statement" | "unavailable";
  periodFrom: string;
  periodTo: string;
  basis: "cash" | "accrual";
  boxes: Record<string, number>;
  gstOnSales: number;       // 1A
  gstOnPurchases: number;   // 1B
  netGst: number;           // 1A - 1B
  paygWithheld: number;     // W5
  netPayment: number;       // box 9 if present, else 1A + W5 - 1B
  totalSales?: number;      // G1
  message?: string;
};

export const getActivityStatementPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { tenantId: string; fromDate: string; toDate: string; basis?: "accrual" | "cash" }) => input,
  )
  .handler(async ({ data, context }): Promise<ActivityStatementPeriod> => {
    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const { assertWidgetAccess, getClientReportBasis } = await import("./access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "tax_liability");
    const conn = await getConnectionByTenant(data.tenantId);
    const basis = data.basis ?? (await getClientReportBasis(data.tenantId).catch(() => "accrual" as const));

    const unavailableMessage =
      "Exact BAS figures require Xero Activity Statement access. This app needs Xero partner certification before this period can load.";

    try {
      const res = await xeroGet<{ Reports: any[] }>(conn, "Reports/ActivityStatement", {
        fromDate: data.fromDate,
        toDate: data.toDate,
      });
      const report = res?.Reports?.[0];
      if (report) {
        const { boxes } = extractBoxes(report);
        if (Object.keys(boxes).length > 0) {
          const get = (k: string) => boxes[k] ?? 0;
          const w5 = get("W5") || get("W2") + get("W3") + get("W4");
          const netGst = get("1A") - get("1B");
          const netPayment = get("9") !== 0 ? get("9") : get("1A") + w5 - get("1B");
          return {
            source: "activity-statement",
            periodFrom: data.fromDate,
            periodTo: data.toDate,
            basis,
            boxes,
            gstOnSales: get("1A"),
            gstOnPurchases: get("1B"),
            netGst,
            paygWithheld: w5,
            netPayment,
            totalSales: get("G1") || undefined,
          };
        }
      }
    } catch (e) {
      return {
        source: "unavailable",
        periodFrom: data.fromDate,
        periodTo: data.toDate,
        basis,
        boxes: {},
        gstOnSales: 0,
        gstOnPurchases: 0,
        netGst: 0,
        paygWithheld: 0,
        netPayment: 0,
        message: unavailableMessage,
      };
    }

    return {
      source: "unavailable",
      periodFrom: data.fromDate,
      periodTo: data.toDate,
      basis,
      boxes: {},
      gstOnSales: 0,
      gstOnPurchases: 0,
      netGst: 0,
      paygWithheld: 0,
      netPayment: 0,
      message: unavailableMessage,
    };
  });

export type SuperPayable = {
  asAtDate: string;
  balance: number;
  lines: { name: string; amount: number }[];
};

export const getSuperPayable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; date: string }) => input)
  .handler(async ({ data, context }): Promise<SuperPayable> => {
    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const { assertWidgetAccess } = await import("./access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "tax_liability");
    const conn = await getConnectionByTenant(data.tenantId);
    const res = await xeroGet<{ Reports: any[] }>(conn, "Reports/BalanceSheet", { date: data.date });
    const report = res.Reports?.[0];
    if (!report) return { asAtDate: data.date, balance: 0, lines: [] };
    const all = extractTaxLines(report);
    const supers = all.filter((l) => l.category === "super").map((l) => ({ name: l.name, amount: l.amount }));
    const balance = supers.reduce((s, l) => s + l.amount, 0);
    return { asAtDate: data.date, balance, lines: supers };
  });

// ============================================================================
// Current tax balance – live Balance Sheet snapshot of GST/PAYG/Super accounts
// ============================================================================

export type CurrentTaxBalance = {
  asAtDate: string;
  gst: number;
  payg: number;
  superannuation: number;
  otherTax: number;
  total: number;
  lines: { name: string; amount: number; category: "gst" | "payg" | "super" | "other-tax" }[];
};

export const getCurrentTaxBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; date?: string }) => input)
  .handler(async ({ data, context }): Promise<CurrentTaxBalance> => {
    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const { assertWidgetAccess } = await import("./access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "tax_liability");
    const conn = await getConnectionByTenant(data.tenantId);
    const date = data.date ?? new Date().toISOString().slice(0, 10);
    const res = await xeroGet<{ Reports: any[] }>(conn, "Reports/BalanceSheet", { date });
    const report = res.Reports?.[0];
    const lines = report ? extractTaxLines(report) : [];
    const out: CurrentTaxBalance = {
      asAtDate: date,
      gst: 0,
      payg: 0,
      superannuation: 0,
      otherTax: 0,
      total: 0,
      lines,
    };
    for (const l of lines) {
      if (l.category === "gst") out.gst += l.amount;
      else if (l.category === "payg") out.payg += l.amount;
      else if (l.category === "super") out.superannuation += l.amount;
      else out.otherTax += l.amount;
    }
    out.total = out.gst + out.payg + out.superannuation + out.otherTax;
    out.lines.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    return out;
  });

// ============================================================================
// Tax liability buckets – not yet due / due now / overdue, with BS reconciliation
// ============================================================================

export type TaxBucket = "not-due" | "due" | "overdue";

export type TaxLiabilityBuckets = {
  asAtDate: string;
  basis: "cash" | "accrual";
  notYetDue: number;
  dueNow: number;
  overdue: number;
  balanceSheetTotal: number;
  bucketTotal: number;
  difference: number;
  lines: {
    name: string;
    category: "gst" | "payg" | "super" | "other-tax";
    balanceSheetAmount: number;
    bucket: TaxBucket;
  }[];
  asUnavailable?: boolean;
  asMessage?: string;
};

function isoAddDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

// Returns the last `count` Australian BAS quarter ranges that ended on/before `asAt`.
function recentBasQuarters(asAtIso: string, count: number): { from: string; to: string }[] {
  const [y, m, d] = asAtIso.split("-").map(Number);
  const asAt = new Date(Date.UTC(y, m - 1, d));
  // Quarter ends: Mar 31, Jun 30, Sep 30, Dec 31
  const quarterEnds = [
    { m: 2, d: 31 }, // Mar
    { m: 5, d: 30 }, // Jun
    { m: 8, d: 30 }, // Sep
    { m: 11, d: 31 }, // Dec
  ];
  const out: { from: string; to: string }[] = [];
  let year = asAt.getUTCFullYear();
  let qi = quarterEnds.length - 1;
  // Walk back until we find a quarter end on/before asAt
  while (true) {
    const qe = new Date(Date.UTC(year, quarterEnds[qi].m, quarterEnds[qi].d));
    if (qe <= asAt) break;
    qi--;
    if (qi < 0) {
      qi = quarterEnds.length - 1;
      year--;
    }
  }
  for (let i = 0; i < count; i++) {
    const qe = quarterEnds[qi];
    const end = new Date(Date.UTC(year, qe.m, qe.d));
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 2, 1));
    const fmt = (dt: Date) =>
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    out.push({ from: fmt(start), to: fmt(end) });
    qi--;
    if (qi < 0) {
      qi = quarterEnds.length - 1;
      year--;
    }
  }
  return out;
}

export const getTaxLiabilityBuckets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; date?: string; basis?: "accrual" | "cash" }) => input)
  .handler(async ({ data, context }): Promise<TaxLiabilityBuckets> => {
    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const { assertWidgetAccess, getClientReportBasis } = await import("./access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "tax_liability");
    const conn = await getConnectionByTenant(data.tenantId);
    const asAt = data.date ?? new Date().toISOString().slice(0, 10);

    const [bsRes, basis] = await Promise.all([
      xeroGet<{ Reports: any[] }>(conn, "Reports/BalanceSheet", {
        date: asAt,
        ...((data.basis ?? null) === "cash" ? { paymentsOnly: "true" } : {}),
      }),
      data.basis
        ? Promise.resolve(data.basis)
        : getClientReportBasis(data.tenantId).catch(() => "accrual" as const),
    ]);
    const bsReport = bsRes.Reports?.[0];
    const bsLines = bsReport ? extractTaxLines(bsReport) : [];
    // Exclude super – it lives in the Superannuation widget.
    const taxLines = bsLines.filter((l) => l.category !== "super");
    const balanceSheetTotal = taxLines.reduce((s, l) => s + l.amount, 0);

    // Per-category BS totals
    const bsByCat: Record<"gst" | "payg" | "other-tax", number> = { gst: 0, payg: 0, "other-tax": 0 };
    for (const l of taxLines) {
      if (l.category === "gst" || l.category === "payg" || l.category === "other-tax") {
        bsByCat[l.category] += l.amount;
      }
    }

    // Pull last 3 BAS quarters to derive lodged amounts and their due dates.
    const quarters = recentBasQuarters(asAt, 3);
    let asUnavailable = false;
    let asMessage: string | undefined;
    const lodgedByCat: { gst: { dueDate: string; amount: number }[]; payg: { dueDate: string; amount: number }[] } = {
      gst: [],
      payg: [],
    };

    for (const q of quarters) {
      try {
        const res = await xeroGet<{ Reports: any[] }>(conn, "Reports/ActivityStatement", {
          fromDate: q.from,
          toDate: q.to,
        });
        const report = res?.Reports?.[0];
        if (!report) continue;
        const { boxes } = extractBoxes(report);
        const get = (k: string) => boxes[k] ?? 0;
        const gstNet = get("1A") - get("1B");
        const paygNet = get("W5") || get("W2") + get("W3") + get("W4");
        const dueDate = isoAddDays(q.to, 28); // standard BAS lodgement window
        if (gstNet !== 0) lodgedByCat.gst.push({ dueDate, amount: gstNet });
        if (paygNet !== 0) lodgedByCat.payg.push({ dueDate, amount: paygNet });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/404|NotFound|not available|not found/i.test(msg)) {
          asUnavailable = true;
          asMessage = "Activity Statement isn't available for this Xero organisation – overdue can't be computed.";
          break;
        }
        // Other errors: skip this quarter silently
      }
    }

    // Bucket each tax category against its BS balance.
    const today = new Date().toISOString().slice(0, 10);
    const bucketByCat: Record<string, { notYetDue: number; dueNow: number; overdue: number }> = {
      gst: { notYetDue: 0, dueNow: 0, overdue: 0 },
      payg: { notYetDue: 0, dueNow: 0, overdue: 0 },
      "other-tax": { notYetDue: 0, dueNow: 0, overdue: 0 },
    };

    function bucketCategory(cat: "gst" | "payg" | "other-tax", lodged: { dueDate: string; amount: number }[]) {
      const bsAmount = bsByCat[cat];
      let remaining = bsAmount;
      let overdue = 0;
      let dueNow = 0;
      if (!asUnavailable && lodged.length) {
        // Sort lodged oldest first so we eat overdue from the BS balance first.
        const sorted = [...lodged].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        for (const l of sorted) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, l.amount);
          if (take <= 0) continue;
          if (l.dueDate < today) overdue += take;
          else dueNow += take;
          remaining -= take;
        }
      }
      bucketByCat[cat] = { overdue, dueNow, notYetDue: remaining };
    }

    bucketCategory("gst", lodgedByCat.gst);
    bucketCategory("payg", lodgedByCat.payg);
    bucketCategory("other-tax", []);

    const notYetDue = bucketByCat.gst.notYetDue + bucketByCat.payg.notYetDue + bucketByCat["other-tax"].notYetDue;
    const dueNow = bucketByCat.gst.dueNow + bucketByCat.payg.dueNow + bucketByCat["other-tax"].dueNow;
    const overdue = bucketByCat.gst.overdue + bucketByCat.payg.overdue + bucketByCat["other-tax"].overdue;
    const bucketTotal = notYetDue + dueNow + overdue;

    // Tag each line with the dominant bucket for its category.
    const dominant = (cat: "gst" | "payg" | "other-tax" | "super"): TaxBucket => {
      if (cat === "super") return "not-due";
      const b = bucketByCat[cat];
      if (b.overdue >= b.dueNow && b.overdue >= b.notYetDue && b.overdue > 0) return "overdue";
      if (b.dueNow >= b.notYetDue && b.dueNow > 0) return "due";
      return "not-due";
    };

    const lines = taxLines
      .map((l) => ({
        name: l.name,
        category: l.category,
        balanceSheetAmount: l.amount,
        bucket: dominant(l.category),
      }))
      .sort((a, b) => Math.abs(b.balanceSheetAmount) - Math.abs(a.balanceSheetAmount));

    return {
      asAtDate: asAt,
      basis,
      notYetDue,
      dueNow,
      overdue,
      balanceSheetTotal,
      bucketTotal,
      difference: balanceSheetTotal - bucketTotal,
      lines,
      asUnavailable: asUnavailable || undefined,
      asMessage,
    };
  });
