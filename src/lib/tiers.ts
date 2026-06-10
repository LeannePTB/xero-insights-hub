export type DashboardTier = "basic" | "advisory" | "investigate";
export type WidgetKey = "revenue_kpis" | "tax_liability" | "pnl" | "breakeven" | "payables";

export const TIER_WIDGETS: Record<DashboardTier, WidgetKey[]> = {
  basic: ["revenue_kpis", "tax_liability"],
  advisory: ["revenue_kpis", "tax_liability", "pnl", "breakeven"],
  investigate: ["revenue_kpis", "tax_liability", "pnl", "breakeven", "payables"],
};

export const TIER_LABEL: Record<DashboardTier, string> = {
  basic: "Basic",
  advisory: "Advisory",
  investigate: "Investigate the Numbers",
};

export const TIER_DESCRIPTION: Record<DashboardTier, string> = {
  basic: "Revenue/expense KPIs and current tax liabilities.",
  advisory: "Everything in Basic plus full P&L and breakeven analysis.",
  investigate: "Full advisory view plus aged payables and supplier exposure.",
};

export const WIDGET_LABEL: Record<WidgetKey, string> = {
  revenue_kpis: "Revenue & Expenses",
  tax_liability: "Tax Liabilities",
  pnl: "Profit & Loss",
  breakeven: "Breakeven",
  payables: "Aged Payables",
};

export function canAccessWidget(tier: DashboardTier, widget: WidgetKey): boolean {
  return TIER_WIDGETS[tier].includes(widget);
}

export const ALL_TIERS: DashboardTier[] = ["basic", "advisory", "investigate"];
