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
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<BusinessHealth> => {
    const { getConnectionByTenant, xeroGet } = await import("./xero/api.server");
    const { assertWidgetAccess } = await import("./xero/access.server");
    await assertWidgetAccess(context.userId, data.tenantId, "health");
    const conn = await getConnectionByTenant(data.tenantId);

    const today = new Date();
    const fy = fyToDateRange(today);
    const asOfDate = fy.to;

    const [pnlRes, bsRes] = await Promise.all([
      xeroGet<{ Reports: any[] }>(conn, "Reports/ProfitAndLoss", {
        fromDate: fy.from,
        toDate: fy.to,
      }),
      xeroGet<{ Reports: any[] }>(conn, "Reports/BalanceSheet", { date: asOfDate }),
    ]);

    const pnl = summarisePnl(pnlRes.Reports?.[0] ?? {});
    const bs = summariseBs(bsRes.Reports?.[0] ?? {});

    const grossMarginPct = pnl.income > 0 ? (pnl.gross / pnl.income) * 100 : 0;
    const netMarginPct = pnl.income > 0 ? (pnl.net / pnl.income) * 100 : 0;

    // Months elapsed in FY to derive avg monthly opex
    const fyStart = new Date(`${fy.from}T00:00:00Z`);
    const monthsElapsed = Math.max(
      1,
      (today.getUTCFullYear() - fyStart.getUTCFullYear()) * 12 +
        (today.getUTCMonth() - fyStart.getUTCMonth()) +
        1,
    );
    const monthlyOpex = pnl.expenses / monthsElapsed;
    const monthsRunway = monthlyOpex > 0 ? bs.cash / monthlyOpex : null;

    const badDebtsPctOfRev = pnl.income > 0 ? (bs.badDebts / pnl.income) * 100 : 0;
    const { score, band, label } = computeScore({
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
      fyFromDate: fy.from,
      fyToDate: fy.to,
      fyLabel: fy.label,
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
      label,
      summary,
      alert,
    };
  });
