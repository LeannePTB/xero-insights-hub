export type DashboardTier = "basic" | "advisory" | "investigate" | "multi_company";
export type WidgetKey = "revenue_kpis" | "tax_liability" | "pnl" | "breakeven" | "payables";

export const ALL_WIDGETS: WidgetKey[] = [
  "revenue_kpis",
  "tax_liability",
  "pnl",
  "breakeven",
  "payables",
];

// Fallback defaults (used only if the DB has no row for a tier).
export const DEFAULT_TIER_WIDGETS: Record<DashboardTier, WidgetKey[]> = {
  basic: ["revenue_kpis", "tax_liability"],
  advisory: ["revenue_kpis", "tax_liability", "pnl", "breakeven"],
  investigate: ["revenue_kpis", "tax_liability", "pnl", "breakeven", "payables"],
  multi_company: ["revenue_kpis", "tax_liability", "pnl", "breakeven", "payables"],
};

export const TIER_LABEL: Record<DashboardTier, string> = {
  basic: "Standard",
  advisory: "Advisory",
  investigate: "Investigate the Numbers",
  multi_company: "Multi company",
};

export const TIER_DESCRIPTION: Record<DashboardTier, string> = {
  basic: "Revenue/expense KPIs and current tax liabilities.",
  advisory: "Everything in Standard plus full P&L and breakeven analysis.",
  investigate: "Full advisory view plus aged payables and supplier exposure.",
  multi_company: "Full dashboard across multiple linked Xero organisations. Required to link more than one Xero file to a client.",
};

export const WIDGET_LABEL: Record<WidgetKey, string> = {
  revenue_kpis: "Revenue & Expenses",
  tax_liability: "Tax Liabilities",
  pnl: "Profit & Loss",
  breakeven: "Breakeven",
  payables: "Aged Payables",
};

export const ALL_TIERS: DashboardTier[] = ["basic", "advisory", "investigate", "multi_company"];

// Only this tier can have more than one Xero organisation linked to a client.
export const MULTI_ORG_TIER: DashboardTier = "multi_company";
