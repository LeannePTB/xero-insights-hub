import type { PillarMetric } from "./health.functions";

export type Recommendation = {
  title: string;
  why: string;
  actions: string[];
  severity: "danger" | "watch" | "info";
};

function find(metrics: PillarMetric[], key: string): PillarMetric | undefined {
  return metrics.find((m) => m.key === key);
}

export function getMoneyRecommendations(metrics: PillarMetric[]): Recommendation[] {
  const recs: Recommendation[] = [];

  const cash = find(metrics, "cash_runway");
  if (cash?.status === "bad") {
    recs.push({
      severity: "danger",
      title: "Cash buffer is critically low",
      why: `Bank balance shows "${cash.pill}" — less than 1 month of operating costs covered.`,
      actions: [
        "Pause all discretionary spend until the buffer rebuilds.",
        "Chase every receivable over 30 days old today — call, don't just email.",
        "Negotiate 14-day extensions with your largest suppliers.",
        "Review owner drawings against current cash position.",
        "Set a minimum cash floor and treat it as untouchable.",
      ],
    });
  } else if (cash?.status === "watch") {
    recs.push({
      severity: "watch",
      title: "Cash buffer is thin",
      why: `Bank covers only 1–3 months of operating costs ("${cash.pill}").`,
      actions: [
        "Tighten payment terms on new work — deposit up front where possible.",
        "Chase receivables weekly, not monthly.",
        "Defer any non-essential capex for the next quarter.",
        "Build a 13-week cash flow forecast and review every Monday.",
      ],
    });
  }

  const net = find(metrics, "net_margin");
  if (net?.status === "bad") {
    recs.push({
      severity: "danger",
      title: "Operating at a loss",
      why: `Net margin is negative (${net.pill}) — the business is consuming cash to run.`,
      actions: [
        "Run a line-by-line pricing review — anything sold below cost gets repriced or dropped.",
        "Cut the three largest fixed overheads first; they move the number fastest.",
        "Audit every subscription and software licence; cancel anything unused for 30+ days.",
        "Lift gross margin before chasing more revenue — unprofitable growth makes it worse.",
      ],
    });
  } else if (net?.status === "watch") {
    recs.push({
      severity: "watch",
      title: "Net margin is thin",
      why: `Net margin sits between 0–10% (${net.pill}) — little room for shocks.`,
      actions: [
        "Revisit pricing on your top 3 products/services — small lifts compound.",
        "Audit subscriptions and recurring spend quarterly.",
        "Batch admin work to reduce hours-spent overhead.",
      ],
    });
  }

  const gm = find(metrics, "gross_margin");
  if (gm?.status === "bad") {
    recs.push({
      severity: "danger",
      title: "Gross margin is under 30%",
      why: `Margin on what you sell ("${gm.pill}") leaves nothing to fund overhead and growth.`,
      actions: [
        "Rebuild the rate card from cost-up, not from what competitors charge.",
        "Renegotiate or replace your two highest cost-of-sales suppliers.",
        "Productise repeatable services into fixed-price packages.",
        "Audit job costs monthly — find the jobs leaking margin and fix or fire them.",
      ],
    });
  }

  const rg = find(metrics, "revenue_growth");
  if (rg?.status === "bad" && rg.pill !== "No prior year") {
    recs.push({
      severity: "watch",
      title: "Revenue is shrinking year-on-year",
      why: `Revenue change: ${rg.pill} versus the same period last year.`,
      actions: [
        "List the top 20 dormant clients from the last 18 months and personally re-engage 5 this week.",
        "Lift prices on your top tier by 5–10% — existing customers rarely churn on that move.",
        "Concentrate marketing on your single highest-margin offer.",
        "Stop low-margin work that's crowding out delivery capacity for better-paying clients.",
      ],
    });
  }

  const debt = find(metrics, "debt_carried");
  if (debt?.status === "bad") {
    recs.push({
      severity: "watch",
      title: "Debt load is heavy versus revenue",
      why: `Liabilities classed as "${debt.pill}" relative to monthly revenue.`,
      actions: [
        "List every facility with rate, balance and minimum repayment.",
        "Aggressively pay down the highest-rate balance first.",
        "Model interest coverage at +2% rates — make sure you'd still cover it.",
        "Speak to your lender about consolidation before refinancing pressure builds.",
      ],
    });
  }

  if (recs.length === 0) {
    return [
      {
        severity: "info",
        title: "Money is in good shape",
        why: "All Money metrics are reading healthy on the current period.",
        actions: [
          "Keep building cash reserves toward a 3-month operating buffer.",
          "Schedule a quarterly margin review on your top revenue lines.",
          "Reinvest a fixed % of profit into growth before drawings increase.",
        ],
      },
    ];
  }

  // Most severe first
  const order = { danger: 0, watch: 1, info: 2 } as const;
  return recs.sort((a, b) => order[a.severity] - order[b.severity]);
}

function parsePct(pill: string | undefined): number | null {
  if (!pill) return null;
  const m = pill.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

export function getEfficiencyRecommendations(metrics: PillarMetric[]): Recommendation[] {
  const recs: Recommendation[] = [];

  const wages = find(metrics, "wages");
  if (wages) {
    const isUntagged = wages.pill === "Not tagged";
    const wagesPct = parsePct(wages.pill);
    if (isUntagged) {
      recs.push({
        severity: "info",
        title: "Wage accounts aren't tagged",
        why: "We can't compute Wages as % of revenue accurately until your wage-related accounts are tagged. Right now we fall back to name matching, which can miss accounts like 'Contract Labour' or 'Director Fees'.",
        actions: [
          "Open Settings → Cost classification and turn on the Wages marker for each wages/salaries/super/contractor account.",
          "Re-open Business Health — the Efficiency pillar will recalculate immediately.",
        ],
      });
    } else if (wages.status === "bad" && wagesPct !== null) {
      recs.push({
        severity: "danger",
        title: `Wages are consuming ${wagesPct.toFixed(1)}% of revenue`,
        why: "Above 50% is generally unsustainable for service businesses — labour is crowding out profit, tax, and reinvestment.",
        actions: [
          "Map revenue per FTE — identify roles whose output doesn't cover their fully loaded cost.",
          "Freeze new hires until revenue per head improves by 10%.",
          "Lift prices on the top 3 services — small increases recover wage drag fast.",
          "Convert lowest-utilisation roles to contract or part-time.",
          "Track billable vs non-billable hours weekly; target <20% non-billable.",
        ],
      });
    } else if (wages.status === "watch" && wagesPct !== null) {
      recs.push({
        severity: "watch",
        title: `Wages at ${wagesPct.toFixed(1)}% of revenue is climbing`,
        why: "30–50% is the warning band — productivity gains or price rises are needed before it tips over.",
        actions: [
          "Set a target wages % and review monthly, not yearly.",
          "Audit overtime and casual top-ups — they often hide a structural staffing gap or surplus.",
          "Push a 3–5% price rise on your highest-volume service.",
        ],
      });
    }
  }

  const op = find(metrics, "operating_profit");
  if (op?.status === "bad") {
    recs.push({
      severity: "danger",
      title: "Operating profit is negative or flat",
      why: `Operating profit reads ${op.pill}. The business isn't generating enough margin after running costs.`,
      actions: [
        "Cut the three largest fixed overheads first — biggest impact for least disruption.",
        "Lift gross margin before chasing revenue; unprofitable growth makes it worse.",
        "Cancel software/subscriptions unused for 30+ days.",
      ],
    });
  }

  const bad = find(metrics, "bad_debts");
  if (bad?.status === "bad") {
    recs.push({
      severity: "danger",
      title: `Bad debts are eroding revenue (${bad.pill})`,
      why: "Above 3% of revenue lost to bad debts indicates weak credit control.",
      actions: [
        "Run credit checks on any new customer above $5k.",
        "Require deposits up-front (30–50%) for new or risky clients.",
        "Stop work the moment an invoice goes 30 days overdue.",
        "Move chronic late payers to direct debit or pre-payment only.",
      ],
    });
  } else if (bad?.status === "watch") {
    recs.push({
      severity: "watch",
      title: `Bad debts trending up (${bad.pill})`,
      why: "1–3% of revenue is recoverable with tighter collections.",
      actions: [
        "Set a 7-day reminder before the due date, not just after.",
        "Automate a 3-step dunning sequence (day 1, day 7, day 14 overdue).",
        "Review your aged receivables every Monday.",
      ],
    });
  }

  const bills = find(metrics, "bills_on_time");
  if (bills?.status === "bad") {
    recs.push({
      severity: "watch",
      title: "Bills are paid late",
      why: `Only ${bills.pill} — late payments damage supplier relationships and credit terms.`,
      actions: [
        "Run a weekly payment batch on a fixed day (e.g. every Thursday).",
        "Negotiate longer terms on your largest 3 suppliers instead of paying late.",
        "Set reminders 3 days before due date, not on the due date.",
      ],
    });
  }

  if (recs.length === 0) {
    return [
      {
        severity: "info",
        title: "Efficiency is in good shape",
        why: "Wages, operating profit, bad debts and supplier payments are all healthy on the current period.",
        actions: [
          "Hold the line — review the same metrics again in 30 days.",
          "Document what's working so it survives staff changes.",
        ],
      },
    ];
  }

  const order = { danger: 0, watch: 1, info: 2 } as const;
  return recs.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function getStabilityRecommendations(metrics: PillarMetric[]): Recommendation[] {
  const recs: Recommendation[] = [];

  const runway = find(metrics, "runway");
  if (runway?.status === "bad") {
    recs.push({
      severity: "danger",
      title: "Less than 1 month of runway",
      why: `Cash on hand covers "${runway.pill}" of operating costs — any shock could be fatal.`,
      actions: [
        "Build a 13-week cash flow forecast today and review it every Monday.",
        "Pause all non-essential spend until runway exceeds 2 months.",
        "Bring forward invoicing — bill weekly, not monthly.",
        "Talk to your bank about an overdraft facility before you need it, not after.",
        "Review owner drawings against the current cash position.",
      ],
    });
  } else if (runway?.status === "watch") {
    recs.push({
      severity: "watch",
      title: "Runway is thin (1–3 months)",
      why: `Cash covers ${runway.pill} — not enough margin to absorb a bad quarter.`,
      actions: [
        "Target 3 months of operating costs in reserve as the minimum cash floor.",
        "Tighten payment terms on new work — deposits up-front where possible.",
        "Defer any non-essential capex for the next quarter.",
      ],
    });
  }

  const conc = find(metrics, "revenue_concentration");
  if (conc?.status === "bad") {
    recs.push({
      severity: "danger",
      title: "Revenue is dangerously concentrated",
      why: `One source dominates revenue ("${conc.pill}") — losing it would break the business.`,
      actions: [
        "Map your top 5 customers/services as a % of revenue.",
        "Set a target: no single customer above 25% of revenue within 12 months.",
        "Invest marketing in the 2nd and 3rd tier services to broaden the base.",
        "Lock in longer-term contracts with the dominant client to buy diversification time.",
      ],
    });
  } else if (conc?.status === "watch") {
    recs.push({
      severity: "watch",
      title: "Revenue base is top-heavy",
      why: `Revenue mix reads "${conc.pill}" — better than single-source but still fragile.`,
      actions: [
        "Identify 3 services/products to actively grow to balance the mix.",
        "Track revenue share monthly so drift is visible early.",
      ],
    });
  }

  const ar = find(metrics, "receivables");
  if (ar?.status === "bad") {
    recs.push({
      severity: "danger",
      title: "Receivables are larger than 2 months of revenue",
      why: `${ar.pill} owed to the business — cash is locked in customers, not the bank.`,
      actions: [
        "Personally call every debtor over 30 days overdue this week.",
        "Stop work the moment an invoice goes 30 days overdue.",
        "Move chronic late payers to direct debit or pre-payment only.",
        "Offer a small early-payment discount (e.g. 2%/7 days) to accelerate cash in.",
        "Tighten terms on new work: 7–14 days instead of 30.",
      ],
    });
  } else if (ar?.status === "watch") {
    recs.push({
      severity: "watch",
      title: "Receivables are building up",
      why: `${ar.pill} outstanding — over 1 month of revenue trapped in debtors.`,
      actions: [
        "Automate a 3-step reminder sequence (day 1, day 7, day 14 overdue).",
        "Review aged receivables every Monday morning.",
        "Send a reminder 3 days before the due date, not just after.",
      ],
    });
  }

  const ap = find(metrics, "payables");
  if (ap?.status === "bad") {
    recs.push({
      severity: "danger",
      title: "Payables are larger than 2 months of revenue",
      why: `${ap.pill} owed to suppliers — supplier risk and credit damage are real if cash slips.`,
      actions: [
        "List every supplier balance with terms and due dates.",
        "Negotiate longer terms with the largest 3 instead of paying late.",
        "Prioritise paying suppliers critical to delivery — protect the revenue line first.",
        "Speak to lenders early about consolidation before relationships strain.",
      ],
    });
  } else if (ap?.status === "watch") {
    recs.push({
      severity: "watch",
      title: "Payables are climbing",
      why: `${ap.pill} owed — over 1 month of revenue in supplier obligations.`,
      actions: [
        "Run a weekly payment batch on a fixed day so suppliers know what to expect.",
        "Match supplier terms to your customer terms to avoid being squeezed in the middle.",
      ],
    });
  }

  if (recs.length === 0) {
    return [
      {
        severity: "info",
        title: "Stability is in good shape",
        why: "Runway, revenue concentration, receivables and payables all look healthy.",
        actions: [
          "Keep building cash reserves toward 6+ months of operating costs.",
          "Re-check revenue concentration quarterly — drift happens slowly.",
          "Document credit-control and payment routines so they survive staff changes.",
        ],
      },
    ];
  }

  const order = { danger: 0, watch: 1, info: 2 } as const;
  return recs.sort((a, b) => order[a.severity] - order[b.severity]);
}
