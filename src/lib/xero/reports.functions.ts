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

export const getTaxLiabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; date?: string }) => input)
  .handler(async ({ data, context }) => {
    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const { assertWidgetAccess } = await import("./access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "tax_liability");
    const conn = await getConnectionByTenant(data.tenantId);
    const res = await xeroGet<{ Reports: any[] }>(conn, "Reports/BalanceSheet", {
      date: data.date,
    });
    const report = res.Reports?.[0];
    if (!report) throw new Error("No Balance Sheet returned by Xero.");

    const out: TaxLiabilities = {
      reportDate: report.ReportDate ?? "",
      asAtDate: report.ReportTitles?.[2] ?? report.ReportTitles?.[1],
      gst: 0,
      payg: 0,
      superannuation: 0,
      totalTaxLiability: 0,
      lines: [],
    };

    walkRows(report.Rows, (r) => {
      if (r.RowType !== "Row" || !r.Cells || r.Cells.length < 2) return;
      const name = r.Cells[0].Value;
      if (!name) return;
      const category = classifyTaxLine(name);
      if (!category) return;
      const amount = parseAmount(r.Cells[1].Value);
      out.lines.push({ name, amount, category });
      if (category === "gst") out.gst += amount;
      else if (category === "payg") out.payg += amount;
      else if (category === "super") out.superannuation += amount;
    });

    out.totalTaxLiability = out.lines.reduce((s, l) => s + l.amount, 0);
    out.lines.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    return out;
  });
