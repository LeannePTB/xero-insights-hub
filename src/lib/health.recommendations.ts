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
