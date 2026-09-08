import { liveSource, mergeSources, type SnapshotSource } from "./snapshot-source";
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
    // The caller cannot name an arbitrary lock: the validator above fixes the
    // set to the three cards that are made of profit and loss figures, and each
    // is still tested against this viewer's own entitlement. Break-Even is
    // authorised as Break-Even, so owning that card without the separate Profit
    // & Loss card still shows figures rather than an error.
    await assertWidgetAccess(context.userId, data.tenantId, data.widget ?? "pnl");

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
    const { liveSource } = await import("./snapshot-source");
    // Profit & loss is fetched from Xero on every load; say so with real
    // provenance rather than letting the card infer it from a query time.
    return { ...summarise(report), basis, source: liveSource("disabled") };
  });

export type TaxLiabilities = {
  reportDate: string;
  asAtDate?: string;
  gst: number;
  payg: number;
  superannuation: number;
  totalTaxLiability: number;
  lines: { name: string; amount: number; category: TaxLineCategory }[];
  mode?: "balance" | "movement";
};

// Tax-line extraction is pure and shared with the snapshot rules engine.
import { extractTaxLines, taxLinesOrThrow } from "./tax-lines";
import type { TaxLineCategory } from "./tax-lines";
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
    // This read feeds the cash-commitments section inside the Break-Even card,
    // which is the card the viewer is entitled to.
    await assertWidgetAccess(context.userId, data.tenantId, "accounting_breakeven");
    const conn = await getConnectionByTenant(data.tenantId);
    const mode = data.mode ?? "balance";

    const [res, accountsRes] = await Promise.all([
      xeroGet<{ Reports: any[] }>(conn, "Reports/BalanceSheet", { date: data.date }),
      xeroGet<{ Accounts?: any[] }>(conn, "Accounts"),
    ]);
    const report = res.Reports?.[0];
    if (!report) throw new Error("No Balance Sheet returned by Xero.");
    const endLines = taxLinesOrThrow(extractTaxLines(report, accountsRes));

    let lines = endLines;
    if (mode === "movement" && data.fromDate) {
      const openingDate = isoDayBefore(data.fromDate);
      const openRes = await xeroGet<{ Reports: any[] }>(conn, "Reports/BalanceSheet", { date: openingDate });
      const openReport = openRes.Reports?.[0];
      const openLines = openReport ? taxLinesOrThrow(extractTaxLines(openReport, accountsRes)) : [];
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




/**
 * Superannuation NOT YET PAID.
 *
 * The answer is the balance on the superannuation liability account: accrued
 * less paid. Xero exposes NO super payment data through its API — the payment
 * batches visible in Xero's own screens, with their Paid/Processing/Failed
 * statuses, are not available to us. Payment is therefore INFERRED from the
 * balance falling, and nothing here may imply we can see a payment.
 *
 * Pay run data is used for one purpose only: to explain an outstanding balance
 * by working backwards from the most recent payday. It is never listed.
 */
export type SuperannuationPosition =
  | { status: "no_super_accounts" }
  | {
      status: "available";
      /** Balance on the super liability account(s), as at today. */
      outstanding: number;
      accounts: { name: string; amount: number }[];
      /** True when whole paydays add up to the outstanding balance. */
      matchesPaydays: boolean;
      /** Number of whole paydays the balance covers, when it matches. */
      unpaidPaydays: number | null;
      /** Oldest payday not covered by a payment, when pay runs are readable. */
      oldestUnpaidPayday: string | null;
      /** Why pay runs could not be used, when they could not. */
      payrollStatus: "available" | "no_payroll" | "not_authorised" | "unavailable";
    };

export const getSuperannuationPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; clientId?: string }) => input)
  .handler(async ({ data, context }): Promise<SuperannuationPosition & { source: SnapshotSource }> => {
    const { assertWidgetAccess } = await import("./access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "superannuation");

    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const { getStatutoryOverrides } = await import("./statutory-overrides.server");
    const conn = await getConnectionByTenant(data.tenantId);
    const overrides = await getStatutoryOverrides(
      context.supabase as any,
      data.clientId ?? null,
      data.tenantId,
    );

    const [bsRes, accountsRes] = await Promise.all([
      xeroGet<{ Reports: any[] }>(conn, "Reports/BalanceSheet", {}),
      xeroGet<{ Accounts?: any[] }>(conn, "Accounts"),
    ]);
    const report = bsRes.Reports?.[0];
    if (!report) throw new Error("No Balance Sheet returned by Xero.");
    const extraction = extractTaxLines(report, accountsRes, overrides);
    const superLines = (extraction.lines ?? []).filter((l) => l.category === "super");
    if (superLines.length === 0) return { status: "no_super_accounts", source: liveSource("disabled") };

    const round = (n: number) => Math.round(n * 100) / 100;
    const outstanding = round(superLines.reduce((s, l) => s + l.amount, 0));

    // Pay runs explain an outstanding balance; they never produce the figure.
    const { loadPayRuns } = await import("./payroll.server");
    const runs = await loadPayRuns({
      supabase: context.supabase,
      tenantId: data.tenantId,
      clientId: data.clientId ?? null,
    });
    const payrollStatus = runs.status;

    // The balance is live; the pay runs may be last night's saved copy. The
    // card must report the older of the two.
    const source =
      mergeSources([
        liveSource("disabled"),
        runs.fromSnapshot
          ? {
              mode: "snapshot" as const,
              asAt: null,
              fetchedAt: runs.fetchedAt ?? null,
              stale: false,
              complete: true,
              connection: "connected" as const,
            }
          : null,
      ]) ?? liveSource("disabled");

    let matchesPaydays = false;
    let unpaidPaydays: number | null = null;
    let oldestUnpaidPayday: string | null = null;

    if (runs.status === "available" && outstanding > 0.005) {
      // Newest payday first: accumulate until the accruals reach the balance.
      const ordered = runs.payRuns
        .filter((r) => !!r.paymentDate)
        .sort((a, b) => (b.paymentDate ?? "").localeCompare(a.paymentDate ?? ""));
      let cumulative = 0;
      for (let i = 0; i < ordered.length; i++) {
        cumulative = round(cumulative + ordered[i]!.super);
        oldestUnpaidPayday = ordered[i]!.paymentDate;
        if (Math.abs(cumulative - outstanding) < 0.005) {
          matchesPaydays = true;
          unpaidPaydays = i + 1;
          break;
        }
        if (cumulative > outstanding) break;
      }
    }

    return {
      source,
      status: "available",
      outstanding,
      accounts: superLines.map((l) => ({ name: l.name, amount: round(l.amount) })),
      matchesPaydays,
      unpaidPaydays,
      oldestUnpaidPayday,
      payrollStatus,
    };
  });


/**
 * PAYG WITHHELD, MONTH BY MONTH, AND WHAT IS STILL OWING.
 *
 * Two independent sources, deliberately:
 *  - the MONTHLY figures come from the `Tax` field on pay runs, filtered by
 *    payment date. That is the field verified against a client's own statement.
 *  - what is STILL OWING is the balance on the PAYG withholding liability
 *    account: accrued less paid.
 *
 * Xero exposes no ATO lodgement or payment data through its API, so payment is
 * INFERRED from that balance falling. Nothing here may imply otherwise.
 */
export type PaygWithholdingPosition =
  | { status: "no_payg_accounts" }
  | { status: "no_payroll"; outstanding: number; reason: "no_payroll" | "not_authorised" | "unavailable" }
  | {
      status: "available";
      /** Balance on the PAYG withholding liability account(s), as at today. */
      outstanding: number;
      accounts: { name: string; amount: number }[];
      /** Newest month first. `month` is the first day of the month, ISO. */
      months: { month: string; withheld: number; payRuns: number; owing: boolean; incomplete: boolean }[];
      /** True when whole months add up to the outstanding balance. */
      matchesMonths: boolean;
      /** Oldest month the balance reaches, matched or not. */
      oldestOwingMonth: string | null;
    };

export const getPaygWithholdingPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; clientId?: string; months?: number }) => input)
  .handler(async ({ data, context }): Promise<PaygWithholdingPosition & { source: SnapshotSource }> => {
    const { assertWidgetAccess } = await import("./access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "payg_withholding");

    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const { getStatutoryOverrides } = await import("./statutory-overrides.server");
    const { sydneyDate, startOfMonth, addMonths } = await import("@/lib/sydney-time");
    const conn = await getConnectionByTenant(data.tenantId);
    const overrides = await getStatutoryOverrides(
      context.supabase as any,
      data.clientId ?? null,
      data.tenantId,
    );

    const [bsRes, accountsRes] = await Promise.all([
      xeroGet<{ Reports: any[] }>(conn, "Reports/BalanceSheet", {}),
      xeroGet<{ Accounts?: any[] }>(conn, "Accounts"),
    ]);
    const report = bsRes.Reports?.[0];
    if (!report) throw new Error("No Balance Sheet returned by Xero.");
    const extraction = extractTaxLines(report, accountsRes, overrides);
    const paygLines = (extraction.lines ?? []).filter((l) => l.category === "payg");
    if (paygLines.length === 0) return { status: "no_payg_accounts", source: liveSource("disabled") };

    const round = (n: number) => Math.round(n * 100) / 100;
    const outstanding = round(paygLines.reduce((s, l) => s + l.amount, 0));

    const { loadPayRuns } = await import("./payroll.server");
    const runs = await loadPayRuns({
      supabase: context.supabase,
      tenantId: data.tenantId,
      clientId: data.clientId ?? null,
    });
    // The balance is live; the pay runs may be last night's saved copy. The
    // card must report the older of the two.
    const source =
      mergeSources([
        liveSource("disabled"),
        runs.fromSnapshot
          ? {
              mode: "snapshot" as const,
              asAt: null,
              fetchedAt: runs.fetchedAt ?? null,
              stale: false,
              complete: true,
              connection: "connected" as const,
            }
          : null,
      ]) ?? liveSource("disabled");

    if (runs.status !== "available") {
      return {
        source,
        status: "no_payroll",
        outstanding,
        reason: runs.status === "no_payroll" ? "no_payroll" : runs.status,
      };
    }

    // Monthly totals from the pay runs' PaymentDate — the date PAYG withholding
    // is reported against.
    const today = sydneyDate();
    const thisMonth = startOfMonth(today);
    const wanted = Math.min(Math.max(data.months ?? 6, 1), 24);
    const monthKeys: string[] = [];
    for (let i = 0; i < wanted; i++) monthKeys.push(startOfMonth(addMonths(thisMonth, -i)));

    const byMonth = new Map<string, { withheld: number; payRuns: number }>();
    for (const r of runs.payRuns) {
      if (!r.paymentDate) continue;
      const key = startOfMonth(r.paymentDate);
      const cur = byMonth.get(key) ?? { withheld: 0, payRuns: 0 };
      cur.withheld = round(cur.withheld + r.tax);
      cur.payRuns += 1;
      byMonth.set(key, cur);
    }

    // Match the outstanding balance against the monthly totals, newest first.
    // Months the balance covers are owing; anything older has been paid.
    let cumulative = 0;
    let matchesMonths = false;
    let oldestOwingMonth: string | null = null;
    const owing = new Set<string>();
    if (outstanding > 0.005) {
      for (const key of monthKeys) {
        const m = byMonth.get(key);
        if (!m) continue;
        cumulative = round(cumulative + m.withheld);
        owing.add(key);
        oldestOwingMonth = key;
        if (Math.abs(cumulative - outstanding) < 0.005) {
          matchesMonths = true;
          break;
        }
        if (cumulative > outstanding) break;
      }
      // No clean division: do not claim a month-by-month split.
      if (!matchesMonths) owing.clear();
    }

    return {
      source,
      status: "available",
      outstanding,
      accounts: paygLines.map((l) => ({ name: l.name, amount: round(l.amount) })),
      months: monthKeys.map((key) => ({
        month: key,
        withheld: byMonth.get(key)?.withheld ?? 0,
        payRuns: byMonth.get(key)?.payRuns ?? 0,
        owing: owing.has(key),
        incomplete: key === thisMonth,
      })),
      matchesMonths,
      oldestOwingMonth,
    };
  });
