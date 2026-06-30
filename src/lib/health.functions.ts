import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HealthBand = "strong" | "watch" | "urgent";

export type BusinessHealth = {
  asOfDate: string;
  fyFromDate: string;
  fyToDate: string;
  fyLabel: string;
  // Headline metrics
  revenue: number;
  grossProfit: number;
  grossMarginPct: number; // 0-100
  netProfit: number;
  netMarginPct: number; // 0-100
  cashInBank: number;
  owedToYou: number;
  badDebts: number;
  // Score
  score: number; // 0-100
  band: HealthBand;
  label: string; // e.g. "Needs some work"
  summary: string; // one-line verdict
  // Optional alert
  alert: null | {
    title: string;
    body: string;
    severity: "warning" | "danger";
  };
};

type ReportRow = {
  RowType: "Header" | "Section" | "Row" | "SummaryRow";
  Title?: string;
  Rows?: ReportRow[];
  Cells?: { Value: string }[];
};

function parseAmount(v: string | undefined): number {
  if (!v) return 0;
  const cleaned = v.replace(/[, ]/g, "").replace(/^\((.*)\)$/, "-$1");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Australian fiscal year: 1 July - 30 June. Year n covers Jul (n-1) -> Jun n.
function fyToDateRange(today: Date): { from: string; to: string; label: string } {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth(); // 0-based
  const startYear = m >= 6 ? y : y - 1; // July = 6
  const endYear = startYear + 1;
  const from = `${startYear}-07-01`;
  const to = today.toISOString().slice(0, 10);
  const label = `FY${String(startYear).slice(-2)}–${String(endYear).slice(-2)} to date`;
  return { from, to, label };
}

function summarisePnl(report: any) {
  let income = 0;
  let cogs = 0;
  let expenses = 0;
  let gross = 0;
  let net = 0;
  const sections: ReportRow[] = report?.Rows ?? [];
  for (const section of sections) {
    if (section.RowType !== "Section") continue;
    const title = (section.Title || "").toLowerCase();
    let summary = 0;
    for (const r of section.Rows ?? []) {
      if (r.RowType === "SummaryRow" && r.Cells && r.Cells.length >= 2) {
        summary = parseAmount(r.Cells[1].Value);
      }
    }
    if (title.includes("income") || title.includes("revenue") || title === "trading income") {
      income += summary;
    } else if (title.includes("cost of sales")) {
      cogs += summary;
    } else if (title === "gross profit") {
      gross = summary;
    } else if (title.includes("expense")) {
      expenses += summary;
    } else if (title.includes("net profit") || title.includes("net loss")) {
      net = summary;
    }
  }
  if (!gross) gross = income - cogs;
  if (!net) net = gross - expenses;
  return { income, cogs, expenses, gross, net };
}

// Walk all leaf rows in BS, collecting {sectionTitle, name, amount}.
function walkBsRows(
  rows: ReportRow[] | undefined,
  sectionTitle: string,
  out: { section: string; name: string; amount: number }[],
) {
  if (!rows) return;
  for (const r of rows) {
    if (r.RowType === "Section") {
      walkBsRows(r.Rows, r.Title || sectionTitle, out);
    } else if (r.RowType === "Row" && r.Cells && r.Cells.length >= 2) {
      const name = r.Cells[0]?.Value ?? "";
      const amount = parseAmount(r.Cells[1]?.Value);
      if (name) out.push({ section: sectionTitle, name, amount });
    }
  }
}

function summariseBs(report: any) {
  const leaves: { section: string; name: string; amount: number }[] = [];
  walkBsRows(report?.Rows, "", leaves);
  let cash = 0;
  let receivables = 0;
  let badDebts = 0;
  for (const l of leaves) {
    const s = l.section.toLowerCase();
    const n = l.name.toLowerCase();
    if (s.includes("bank")) cash += l.amount;
    if (n.includes("doubtful") || n.includes("bad debt") || n.includes("allowance for")) {
      // Allowance is usually a negative contra; surface absolute value
      badDebts += Math.abs(l.amount);
    }
    if (
      s.includes("receivable") ||
      n.includes("accounts receivable") ||
      n.includes("trade debtor")
    ) {
      receivables += l.amount;
    }
  }
  return { cash, receivables, badDebts };
}

function computeScore(input: {
  netMarginPct: number;
  grossMarginPct: number;
  badDebtsPctOfRev: number;
  monthsRunway: number | null;
}): { score: number; band: HealthBand; label: string } {
  // Sub-scores 0-100
  // Money (40%): net margin (60), gross margin (40)
  const nm = Math.max(0, Math.min(100, input.netMarginPct * 5)); // 20% net => 100
  const gm = Math.max(0, Math.min(100, input.grossMarginPct * 1.5)); // ~67% => 100
  const money = nm * 0.6 + gm * 0.4;

  // Efficiency (30%): bad debts penalty (lower is better)
  const bd = Math.max(0, 100 - input.badDebtsPctOfRev * 10); // 10% => 0
  const efficiency = bd;

  // Stability (30%): months runway (cash / monthly opex). 6+ => 100; 0 => 0
  let stability = 50;
  if (input.monthsRunway !== null) {
    stability = Math.max(0, Math.min(100, (input.monthsRunway / 6) * 100));
  }

  const score = Math.round(money * 0.4 + efficiency * 0.3 + stability * 0.3);
  let band: HealthBand = "urgent";
  let label = "Urgent attention";
  if (score >= 80) {
    band = "strong";
    label = "Strong";
  } else if (score >= 60) {
    band = "watch";
    label = "Needs some work";
  }
  return { score, band, label };
}

function fmtPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

function pickAlert(h: {
  badDebts: number;
  revenue: number;
  monthsRunway: number | null;
  netMarginPct: number;
  cashInBank: number;
}): BusinessHealth["alert"] {
  const badDebtPct = h.revenue > 0 ? (h.badDebts / h.revenue) * 100 : 0;
  type Candidate = { weight: number; alert: NonNullable<BusinessHealth["alert"]> };
  const candidates: Candidate[] = [];
  if (badDebtPct >= 3) {
    candidates.push({
      weight: badDebtPct,
      alert: {
        title: "Priority alert — bad debts",
        body: `Bad debts are ${fmtPct(badDebtPct)} of revenue. Immediate action recommended.`,
        severity: badDebtPct >= 8 ? "danger" : "warning",
      },
    });
  }
  if (h.monthsRunway !== null && h.monthsRunway < 2) {
    candidates.push({
      weight: 50 + (2 - h.monthsRunway) * 20,
      alert: {
        title: "Priority alert — cash runway",
        body: `Less than ${h.monthsRunway < 1 ? "1 month" : "2 months"} of cash runway at current operating costs.`,
        severity: h.monthsRunway < 1 ? "danger" : "warning",
      },
    });
  }
  if (h.netMarginPct < 0) {
    candidates.push({
      weight: 40 + Math.abs(h.netMarginPct),
      alert: {
        title: "Priority alert — operating loss",
        body: `Net margin is ${fmtPct(h.netMarginPct)} for the period.`,
        severity: "danger",
      },
    });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.weight - a.weight);
  return candidates[0].alert;
}

function buildSummary(h: {
  netMarginPct: number;
  cashInBank: number;
  badDebts: number;
  revenue: number;
  monthsRunway: number | null;
}): string {
  const profitable = h.netMarginPct >= 5;
  const lowCash = h.monthsRunway !== null && h.monthsRunway < 2;
  const bdPct = h.revenue > 0 ? (h.badDebts / h.revenue) * 100 : 0;
  const bits: string[] = [];
  bits.push(profitable ? "Strong profitability" : h.netMarginPct >= 0 ? "Modest profitability" : "Operating at a loss");
  if (lowCash) bits.push("cash is very tight");
  if (bdPct >= 3) bits.push("bad debts need urgent attention");
  if (bits.length === 1 && profitable && !lowCash && bdPct < 3) {
    return "All key financial signals look healthy.";
  }
  return bits.join(" but ").replace(/ but ([a-z])/, " and $1") + ".";
}

export const getBusinessHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; fromDate?: string; toDate?: string }) => input)
  .handler(async ({ data, context }): Promise<BusinessHealth> => {
    const { getConnectionByTenant, xeroGet } = await import("./xero/api.server");
    const { assertWidgetAccess } = await import("./xero/access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "health");
    const conn = await getConnectionByTenant(data.tenantId);

    const today = new Date();
    const fyDefault = fyToDateRange(today);
    const fromDate = data.fromDate || fyDefault.from;
    const toDate = data.toDate || fyDefault.to;
    const isFy = !data.fromDate && !data.toDate;
    const rangeLabel = isFy
      ? fyDefault.label
      : `${fromDate} → ${toDate}`;
    const asOfDate = toDate;

    const [pnlRes, bsRes] = await Promise.all([
      xeroGet<{ Reports: any[] }>(conn, "Reports/ProfitAndLoss", {
        fromDate,
        toDate,
      }),
      xeroGet<{ Reports: any[] }>(conn, "Reports/BalanceSheet", { date: asOfDate }),
    ]);

    const pnl = summarisePnl(pnlRes.Reports?.[0] ?? {});
    const bs = summariseBs(bsRes.Reports?.[0] ?? {});

    const grossMarginPct = pnl.income > 0 ? (pnl.gross / pnl.income) * 100 : 0;
    const netMarginPct = pnl.income > 0 ? (pnl.net / pnl.income) * 100 : 0;

    const startD = new Date(`${fromDate}T00:00:00Z`);
    const endD = new Date(`${toDate}T00:00:00Z`);
    const monthsElapsed = Math.max(
      1,
      (endD.getUTCFullYear() - startD.getUTCFullYear()) * 12 +
        (endD.getUTCMonth() - startD.getUTCMonth()) +
        1,
    );
    const monthlyOpex = pnl.expenses / monthsElapsed;
    const monthsRunway = monthlyOpex > 0 ? bs.cash / monthlyOpex : null;

    const badDebtsPctOfRev = pnl.income > 0 ? (bs.badDebts / pnl.income) * 100 : 0;
    const { score, band, label: bandLabel } = computeScore({
      netMarginPct,
      grossMarginPct,
      badDebtsPctOfRev,
      monthsRunway,
    });

    const summary = buildSummary({
      netMarginPct,
      cashInBank: bs.cash,
      badDebts: bs.badDebts,
      revenue: pnl.income,
      monthsRunway,
    });
    const alert = pickAlert({
      badDebts: bs.badDebts,
      revenue: pnl.income,
      monthsRunway,
      netMarginPct,
      cashInBank: bs.cash,
    });

    return {
      asOfDate,
      fyFromDate: fromDate,
      fyToDate: toDate,
      fyLabel: rangeLabel,
      revenue: pnl.income,
      grossProfit: pnl.gross,
      grossMarginPct,
      netProfit: pnl.net,
      netMarginPct,
      cashInBank: bs.cash,
      owedToYou: bs.receivables,
      badDebts: bs.badDebts,
      score,
      band,
      label: bandLabel,
      summary,
      alert,
    };
  });

// ============================================================
// Business Health — detail (pillar breakdown)
// ============================================================

export type PillarStatus = "good" | "watch" | "bad" | "neutral" | "not_in_xero";
export type PillarMetric = {
  key?: string;
  label: string;
  pill: string;
  status: PillarStatus;
};
export type Pillar = {
  key: "money" | "efficiency" | "growth" | "stability";
  title: string;
  subtitle: string;
  score: number | null; // null => "—/100"
  metrics: PillarMetric[];
  ctaLabel: string;
};

export type BusinessHealthDetail = {
  asOfDate: string;
  fyLabel: string;
  currency: string;
  pillars: Pillar[];
};

// Collect leaf account rows from any P&L section whose title matches the predicate.
// Recurses through nested Section rows so accounts grouped under sub-sections
// (e.g. inside "Operating Expenses") are still picked up.
function pnlSectionRows(report: any, predicate: (title: string) => boolean): { name: string; amount: number }[] {
  const out: { name: string; amount: number }[] = [];
  function collectLeaves(rows: ReportRow[] | undefined) {
    if (!rows) return;
    for (const r of rows) {
      if (r.RowType === "Section") {
        collectLeaves(r.Rows);
      } else if (r.RowType === "Row" && r.Cells && r.Cells.length >= 2) {
        const name = r.Cells[0]?.Value ?? "";
        const amount = parseAmount(r.Cells[1]?.Value);
        if (name) out.push({ name, amount });
      }
    }
  }
  const sections: ReportRow[] = report?.Rows ?? [];
  for (const section of sections) {
    if (section.RowType !== "Section") continue;
    const title = (section.Title || "").toLowerCase();
    if (!predicate(title)) continue;
    collectLeaves(section.Rows);
  }
  return out;
}

function sumLiabilities(report: any): number {
  const leaves: { section: string; name: string; amount: number }[] = [];
  walkBsRows(report?.Rows, "", leaves);
  let liabilities = 0;
  for (const l of leaves) {
    const s = l.section.toLowerCase();
    if (s.includes("liabilit") || s.includes("loan") || s.includes("borrowing")) {
      liabilities += l.amount;
    }
  }
  return liabilities;
}

// Aged Payables/Receivables summary report → total + overdue (>0 days bucket)
function summariseAgedReport(report: any): { total: number; overdue: number } {
  // Xero aged-by-contact summary report rows: each contact row has cells:
  // [Contact, Current, <1mo, 1mo, 2mo, Older, Total]
  let total = 0;
  let overdue = 0;
  const sections: ReportRow[] = report?.Rows ?? [];
  function walk(rows: ReportRow[] | undefined) {
    if (!rows) return;
    for (const r of rows) {
      if (r.RowType === "Section") walk(r.Rows);
      else if ((r.RowType === "Row" || r.RowType === "SummaryRow") && r.Cells) {
        const cells = r.Cells.map((c) => c?.Value ?? "");
        // Total is the last cell; current is the second cell (after contact)
        if (cells.length >= 6 && r.RowType === "SummaryRow") {
          const t = parseAmount(cells[cells.length - 1]);
          const current = parseAmount(cells[1]);
          total += t;
          overdue += Math.max(0, t - current);
        }
      }
    }
  }
  walk(sections);
  return { total, overdue };
}

function statusFor(value: number, thresholds: { good: number; watch: number }, lowerIsBetter = false): PillarStatus {
  if (lowerIsBetter) {
    if (value <= thresholds.good) return "good";
    if (value <= thresholds.watch) return "watch";
    return "bad";
  }
  if (value >= thresholds.good) return "good";
  if (value >= thresholds.watch) return "watch";
  return "bad";
}

function scoreFromMetrics(weighted: { score: number; weight: number }[]): number | null {
  const items = weighted.filter((w) => Number.isFinite(w.score));
  if (items.length === 0) return null;
  const totalW = items.reduce((s, w) => s + w.weight, 0);
  if (totalW === 0) return null;
  const sum = items.reduce((s, w) => s + w.score * w.weight, 0);
  return Math.round(Math.max(0, Math.min(100, sum / totalW)));
}

export const getBusinessHealthDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<BusinessHealthDetail> => {
    const { getConnectionByTenant, xeroGet } = await import("./xero/api.server");
    const { assertWidgetAccess } = await import("./xero/access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "health");
    const conn = await getConnectionByTenant(data.tenantId);

    const today = new Date();
    const fy = fyToDateRange(today);
    const asOfDate = fy.to;

    // Prior FY same window (same number of days)
    const priorFromYear = parseInt(fy.from.slice(0, 4), 10) - 1;
    const priorFrom = `${priorFromYear}-07-01`;
    const priorTo = new Date(today);
    priorTo.setUTCFullYear(priorTo.getUTCFullYear() - 1);
    const priorToStr = priorTo.toISOString().slice(0, 10);

    const safeGet = async <T,>(path: string, params: Record<string, string | undefined> = {}): Promise<T | null> => {
      try {
        return await xeroGet<T>(conn, path, params);
      } catch (e) {
        console.warn(`[health-detail] ${path} failed:`, (e as Error).message);
        return null;
      }
    };

    const [pnlRes, priorPnlRes, bsRes, agedRecRes, agedPayRes, orgRes] = await Promise.all([
      safeGet<{ Reports: any[] }>("Reports/ProfitAndLoss", { fromDate: fy.from, toDate: fy.to }),
      safeGet<{ Reports: any[] }>("Reports/ProfitAndLoss", { fromDate: priorFrom, toDate: priorToStr }),
      safeGet<{ Reports: any[] }>("Reports/BalanceSheet", { date: asOfDate }),
      safeGet<{ Reports: any[] }>("Reports/AgedReceivablesByContact", { date: asOfDate }),
      safeGet<{ Reports: any[] }>("Reports/AgedPayablesByContact", { date: asOfDate }),
      safeGet<{ Organisations: any[] }>("Organisations"),
    ]);

    const pnl = summarisePnl(pnlRes?.Reports?.[0] ?? {});
    const priorPnl = summarisePnl(priorPnlRes?.Reports?.[0] ?? {});
    const bs = summariseBs(bsRes?.Reports?.[0] ?? {});
    const liabilities = sumLiabilities(bsRes?.Reports?.[0] ?? {});
    const ap = summariseAgedReport(agedPayRes?.Reports?.[0] ?? {});
    const ar = summariseAgedReport(agedRecRes?.Reports?.[0] ?? {});
    const currency = (orgRes?.Organisations?.[0]?.BaseCurrency as string) ?? "AUD";

    // Income breakdown for "single source" detection (top revenue account share)
    const incomeRows = pnlSectionRows(pnlRes?.Reports?.[0] ?? {}, (t) =>
      t.includes("income") || t.includes("revenue"),
    );
    const incomeTotal = incomeRows.reduce((s, r) => s + r.amount, 0) || pnl.income;
    const topIncome = incomeRows.reduce((m, r) => (r.amount > m ? r.amount : m), 0);
    const topIncomeShare = incomeTotal > 0 ? (topIncome / incomeTotal) * 100 : 0;

    // Wages: prefer accounts tagged 'wages' in cost classifications; fall back to name detection.
    const { data: wageTagRows } = await context.supabase
      .from("client_cost_classifications" as any)
      .select("account_name, classification")
      .eq("tenant_id", data.tenantId);
    const taggedWageNames = new Set<string>(
      ((wageTagRows ?? []) as any[])
        .filter((r) => r.classification === "wages")
        .map((r) => String(r.account_name).toLowerCase()),
    );
    const expenseRows = pnlSectionRows(pnlRes?.Reports?.[0] ?? {}, (t) =>
      t.includes("expense") || t.includes("operating") || t.includes("less operating"),
    );
    const wageRegex = /wage|salary|salaries|superannuation|payroll|staff|employee|contract\s*labou?r|sub[-\s]*contract|director'?s?\s*fee|payg|kiwisaver|bonus|commission/i;
    const taggedWages = expenseRows
      .filter((r) => taggedWageNames.has(r.name.toLowerCase()))
      .reduce((s, r) => s + r.amount, 0);
    const detectedWages = expenseRows
      .filter((r) => wageRegex.test(r.name))
      .reduce((s, r) => s + r.amount, 0);
    const wages = taggedWageNames.size > 0 ? taggedWages : detectedWages;
    const wagesIsTagged = taggedWageNames.size > 0;

    const grossMarginPct = pnl.income > 0 ? (pnl.gross / pnl.income) * 100 : 0;
    const netMarginPct = pnl.income > 0 ? (pnl.net / pnl.income) * 100 : 0;
    const opMarginPct = netMarginPct; // approximation when no tax/interest separation
    const wagesPct = pnl.income > 0 ? (wages / pnl.income) * 100 : 0;
    const badDebtsPct = pnl.income > 0 ? (bs.badDebts / pnl.income) * 100 : 0;
    const billsOnTimePct = ap.total > 0 ? ((ap.total - ap.overdue) / ap.total) * 100 : 100;

    const fyStart = new Date(`${fy.from}T00:00:00Z`);
    const monthsElapsed = Math.max(
      1,
      (today.getUTCFullYear() - fyStart.getUTCFullYear()) * 12 +
        (today.getUTCMonth() - fyStart.getUTCMonth()) + 1,
    );
    const monthlyOpex = pnl.expenses / monthsElapsed;
    const monthlyRevenue = pnl.income / monthsElapsed;
    const monthsRunway = monthlyOpex > 0 ? bs.cash / monthlyOpex : null;
    const revenueGrowthPct = priorPnl.income > 0 ? ((pnl.income - priorPnl.income) / priorPnl.income) * 100 : null;

    const fmtMoney = (n: number) =>
      new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

    // ---------- MONEY ----------
    const moneyMetrics: PillarMetric[] = [
      revenueGrowthPct === null
        ? { key: "revenue_growth", label: "Revenue growing?", pill: "No prior year", status: "neutral" }
        : { key: "revenue_growth", label: "Revenue growing?", pill: `${revenueGrowthPct >= 0 ? "+" : ""}${revenueGrowthPct.toFixed(1)}%`, status: statusFor(revenueGrowthPct, { good: 5, watch: 0 }) },
      { key: "gross_margin", label: `Gross margin ${grossMarginPct.toFixed(1)}%`, pill: grossMarginPct >= 60 ? "Great" : grossMarginPct >= 45 ? "Good" : grossMarginPct >= 30 ? "OK" : "Poor", status: statusFor(grossMarginPct, { good: 45, watch: 30 }) },
      { key: "net_margin", label: `Net margin ${netMarginPct.toFixed(1)}%`, pill: netMarginPct >= 10 ? "Healthy" : netMarginPct >= 0 ? "Thin" : "Loss", status: statusFor(netMarginPct, { good: 10, watch: 0 }) },
      {
        key: "cash_runway",
        label: "Cash in bank",
        pill: monthsRunway === null ? fmtMoney(bs.cash) : monthsRunway >= 3 ? "Healthy" : monthsRunway >= 1 ? "Low" : "Very low",
        status: monthsRunway === null ? "neutral" : statusFor(monthsRunway, { good: 3, watch: 1 }),
      },
      {
        key: "debt_carried",
        label: "Debt carried",
        pill: liabilities <= 0 ? "None" : liabilities < monthlyRevenue * 1 ? "Minimal" : liabilities < monthlyRevenue * 6 ? "Moderate" : "High",
        status: liabilities <= 0 ? "good" : statusFor(liabilities, { good: monthlyRevenue, watch: monthlyRevenue * 6 }, true),
      },
    ];
    const moneyScore = scoreFromMetrics([
      { score: Math.max(0, Math.min(100, netMarginPct * 5)), weight: 0.4 },
      { score: Math.max(0, Math.min(100, grossMarginPct * 1.5)), weight: 0.3 },
      { score: monthsRunway === null ? 50 : Math.min(100, monthsRunway * 25), weight: 0.2 },
      { score: revenueGrowthPct === null ? 50 : Math.max(0, Math.min(100, 50 + revenueGrowthPct * 2)), weight: 0.1 },
    ]);

    // ---------- EFFICIENCY ----------
    const wagesPill =
      wages > 0
        ? `${wagesPct.toFixed(1)}%${wagesIsTagged ? "" : " (auto)"}`
        : wagesIsTagged
          ? "Tagged: $0"
          : "Not tagged";
    const efficiencyMetrics: PillarMetric[] = [
      { key: "operating_profit", label: "Operating profit %", pill: `${opMarginPct.toFixed(1)}%`, status: statusFor(opMarginPct, { good: 10, watch: 0 }) },
      { key: "wages", label: "Wages as % of rev", pill: wagesPill, status: wages === 0 ? "neutral" : statusFor(wagesPct, { good: 30, watch: 50 }, true) },
      { key: "bad_debts", label: "Bad debts as % of rev", pill: `${badDebtsPct.toFixed(1)}%`, status: statusFor(badDebtsPct, { good: 1, watch: 3 }, true) },
      { key: "bills_on_time", label: "Bills paid on time", pill: ap.total === 0 ? "None owing" : ap.overdue === 0 ? "All current" : `${billsOnTimePct.toFixed(0)}% current`, status: statusFor(billsOnTimePct, { good: 90, watch: 70 }) },
    ];
    const efficiencyScore = scoreFromMetrics([
      { score: Math.max(0, Math.min(100, opMarginPct * 5)), weight: 0.4 },
      { score: wages === 0 ? 50 : Math.max(0, Math.min(100, 100 - (wagesPct - 30) * 2)), weight: 0.2 },
      { score: Math.max(0, 100 - badDebtsPct * 10), weight: 0.2 },
      { score: billsOnTimePct, weight: 0.2 },
    ]);

    // ---------- GROWTH ----------
    const growthMetrics: PillarMetric[] = [
      { label: "Revenue single source", pill: topIncomeShare >= 80 ? `${topIncomeShare.toFixed(0)}% one account` : topIncomeShare >= 50 ? "Concentrated" : "Diversified", status: statusFor(topIncomeShare, { good: 50, watch: 80 }, true) },
      { label: "New customers", pill: "Not in Xero", status: "not_in_xero" },
      { label: "Pipeline leads", pill: "Not in Xero", status: "not_in_xero" },
      revenueGrowthPct === null
        ? { label: "Monthly rev trend", pill: "No comparison", status: "neutral" }
        : { label: "Monthly rev trend", pill: `${revenueGrowthPct >= 0 ? "+" : ""}${revenueGrowthPct.toFixed(1)}% YoY`, status: statusFor(revenueGrowthPct, { good: 5, watch: 0 }) },
    ];
    const growthScore = scoreFromMetrics([
      { score: Math.max(0, Math.min(100, 100 - (topIncomeShare - 30) * 1.2)), weight: 0.5 },
      ...(revenueGrowthPct === null ? [] : [{ score: Math.max(0, Math.min(100, 50 + revenueGrowthPct * 2)), weight: 0.5 }]),
    ]);

    // ---------- STABILITY ----------
    const runwayPill =
      monthsRunway === null ? "Unknown" : monthsRunway < 1 ? "<1 month" : monthsRunway < 3 ? `${monthsRunway.toFixed(1)} months` : `${monthsRunway.toFixed(1)}+ months`;
    const stabilityMetrics: PillarMetric[] = [
      { label: "Months of runway", pill: runwayPill, status: monthsRunway === null ? "neutral" : statusFor(monthsRunway, { good: 3, watch: 1 }) },
      { label: "Revenue concentration", pill: topIncomeShare >= 80 ? "Single service" : topIncomeShare >= 50 ? "Top-heavy" : "Spread", status: statusFor(topIncomeShare, { good: 50, watch: 80 }, true) },
      { label: "Debts owed to business", pill: ar.total > 0 ? `${fmtMoney(ar.total)} outstanding` : "None", status: ar.total > monthlyRevenue * 2 ? "bad" : ar.total > monthlyRevenue ? "watch" : "good" },
      { label: "Amount business owes", pill: ap.total > 0 ? `Only ${fmtMoney(ap.total)}` : "None", status: ap.total > monthlyRevenue * 2 ? "bad" : ap.total > monthlyRevenue ? "watch" : "good" },
    ];
    const stabilityScore = scoreFromMetrics([
      { score: monthsRunway === null ? 50 : Math.min(100, monthsRunway * 25), weight: 0.4 },
      { score: Math.max(0, Math.min(100, 100 - (topIncomeShare - 30) * 1.2)), weight: 0.2 },
      { score: monthlyRevenue > 0 ? Math.max(0, 100 - (ar.total / monthlyRevenue) * 20) : 50, weight: 0.2 },
      { score: monthlyRevenue > 0 ? Math.max(0, 100 - (ap.total / monthlyRevenue) * 20) : 50, weight: 0.2 },
    ]);

    return {
      asOfDate,
      fyLabel: fy.label,
      currency,
      pillars: [
        { key: "money", title: "Money", subtitle: "Are you profitable?", score: moneyScore, metrics: moneyMetrics, ctaLabel: "Why is cash so low?" },
        { key: "efficiency", title: "Efficiency", subtitle: "Is the team productive?", score: efficiencyScore, metrics: efficiencyMetrics, ctaLabel: "Improve efficiency" },
        { key: "growth", title: "Growth", subtitle: "Is the pipeline full?", score: growthScore, metrics: growthMetrics, ctaLabel: "Diversification risk" },
        { key: "stability", title: "Stability", subtitle: "Could you weather a storm?", score: stabilityScore, metrics: stabilityMetrics, ctaLabel: "What to do now" },
      ],
    };
  });
