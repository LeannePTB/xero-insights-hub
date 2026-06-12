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
      widget?: "revenue_kpis" | "pnl" | "breakeven";
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
  const lines: TaxLiabilities["lines"] = [];
  walkRows(report?.Rows, (r) => {
    if (r.RowType !== "Row" || !r.Cells || r.Cells.length < 2) return;
    const name = r.Cells[0].Value;
    if (!name) return;
    const category = classifyTaxLine(name);
    if (!category) return;
    const amount = parseAmount(r.Cells[1].Value);
    lines.push({ name, amount, category });
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

function looksLikeBoxCode(s: string | undefined): boolean {
  if (!s) return false;
  return BOX_CODE_REGEX.test(s.trim());
}

function extractBoxes(report: any): { boxes: Record<string, number>; lines: ActivityStatement["lines"] } {
  const boxes: Record<string, number> = {};
  const lines: ActivityStatement["lines"] = [];
  walkRows(report?.Rows, (r) => {
    if ((r.RowType !== "Row" && r.RowType !== "SummaryRow") || !r.Cells) return;
    const cells = r.Cells;
    if (cells.length < 2) return;
    // Try to find a box code in any of the first 3 cells, value in the last numeric cell.
    let code: string | undefined;
    let label: string | undefined;
    for (let i = 0; i < Math.min(3, cells.length); i++) {
      const v = (cells[i]?.Value ?? "").toString().trim();
      if (looksLikeBoxCode(v)) {
        code = v;
      } else if (v && !label) {
        label = v;
      }
    }
    if (!code) return;
    // amount = last cell with a parseable number
    let amount = 0;
    for (let i = cells.length - 1; i >= 0; i--) {
      const raw = (cells[i]?.Value ?? "").toString();
      if (!raw) continue;
      const n = Number(raw.replace(/[, ]/g, "").replace(/^\((.*)\)$/, "-$1"));
      if (Number.isFinite(n) && raw.match(/[\d]/)) {
        amount = n;
        break;
      }
    }
    boxes[code] = amount;
    lines.push({ code, label: label ?? code, amount });
  });
  return { boxes, lines };
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
