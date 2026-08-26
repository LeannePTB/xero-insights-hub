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
  out.cogsLines.sort((a, b) => b.amount - a.amount);
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
      widget?: "pnl" | "accounting_breakeven" | "true_breakeven";
      basis?: "accrual" | "cash";
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const { assertWidgetAccess, getClientReportBasis } = await import("./access.server");
    // The caller does not choose which lock is tested. `data.widget` is a
    // label for the calling card only; profit and loss always requires `pnl`.
    await assertWidgetAccess(context.userId, data.tenantId, "pnl");
    const conn = await getConnectionByTenant(data.tenantId);
    const basis = data.basis ?? (await getClientReportBasis(data.tenantId));
    const res = await xeroGet<{ Reports: any[] }>(conn, "Reports/ProfitAndLoss", {
      fromDate: data.fromDate,
      toDate: data.toDate,
      standardLayout: "false",
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

// Tax-line extraction is pure and shared with the snapshot rules engine.
import { buildProtectedMoney, extractTaxLines } from "./tax-lines";
import type { ProtectedMoney } from "./tax-lines";
export { classifyTaxLine, extractTaxLines, buildProtectedMoney } from "./tax-lines";
export type {
  ProtectedMoney,
  ProtectedMoneyComponent,
  ProtectedMoneyComponentKey,
} from "./tax-lines";


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

    // Xero's Accounting API has no Activity Statement endpoint, so lodged BAS
    // amounts (and therefore due/overdue splits) can't be sourced from Xero.
    const asUnavailable = true;
    const asMessage =
      "Lodged BAS amounts aren't available from Xero's API, so tax can't be split into due and overdue. The balance sheet totals below are accurate.";
    const lodgedByCat: { gst: { dueDate: string; amount: number }[]; payg: { dueDate: string; amount: number }[] } = {
      gst: [],
      payg: [],
    };

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

// ============================================================================
// Protected money – money the business holds but does not own.
// GST net position + PAYG withheld not yet remitted + superannuation accrued
// but unpaid. Superannuation IS included here (unlike getTaxLiabilityBuckets):
// it is already owed to employees.
//
// The builder and its types live in `./tax-lines` so the snapshot rules engine
// can reuse them without importing the Xero API client. They are re-exported
// at the top of this file.
// ============================================================================


export const getProtectedMoney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; date?: string }) => input)
  .handler(async ({ data, context }): Promise<ProtectedMoney> => {
    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const { assertWidgetAccess } = await import("./access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "tax_liability");
    const conn = await getConnectionByTenant(data.tenantId);
    const date = data.date ?? new Date().toISOString().slice(0, 10);
    const res = await xeroGet<{ Reports: any[] }>(conn, "Reports/BalanceSheet", { date });
    const report = res.Reports?.[0];
    const lines = report ? extractTaxLines(report) : [];
    return buildProtectedMoney(date, lines);
  });
