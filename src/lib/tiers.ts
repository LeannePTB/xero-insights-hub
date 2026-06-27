export type DashboardTier = "basic" | "advisory" | "investigate" | "multi_company";
export type WidgetKey =
  | "health"
  | "receivables"
  | "payables"
  | "pnl"
  | "unreconciled"
  | "tax_liability"
  | "superannuation"
  | "breakeven";

export const ALL_WIDGETS: WidgetKey[] = [
  "health",
  "receivables",
  "payables",
  "pnl",
  "unreconciled",
  "tax_liability",
  "superannuation",
  "breakeven",
];

// Fallback defaults (used only if the DB has no row for a tier).
export const DEFAULT_TIER_WIDGETS: Record<DashboardTier, WidgetKey[]> = {
  basic: ["health", "receivables", "payables", "pnl", "unreconciled"],
  advisory: ["health", "receivables", "payables", "pnl", "unreconciled", "tax_liability", "superannuation", "breakeven"],
  investigate: ["health", "receivables", "payables", "pnl", "unreconciled", "tax_liability", "superannuation", "breakeven"],
  multi_company: ["health", "receivables", "payables", "pnl", "unreconciled", "tax_liability", "superannuation", "breakeven"],
};

export const TIER_LABEL: Record<DashboardTier, string> = {
  basic: "Standard",
  advisory: "Advisory",
  investigate: "Investigate the Numbers",
  multi_company: "Multi company",
};

export const TIER_DESCRIPTION: Record<DashboardTier, string> = {
  basic: "Health, receivables, payables, P&L and unreconciled transactions.",
  advisory: "Everything in Standard plus tax, super and breakeven analysis.",
  investigate: "Full advisory view across one Xero organisation.",
  multi_company: "Full dashboard across multiple linked Xero organisations. Required to link more than one Xero file to a client.",
};

export const WIDGET_LABEL: Record<WidgetKey, string> = {
  health: "Business Health",
  receivables: "Aged Receivables",
  payables: "Aged Payables",
  pnl: "Profit & Loss",
  unreconciled: "Unreconciled Transactions",
  tax_liability: "Tax Liabilities",
  superannuation: "Superannuation Liabilities",
  breakeven: "Breakeven",
};

export const ALL_TIERS: DashboardTier[] = ["basic", "advisory", "investigate", "multi_company"];

// Only this tier can have more than one Xero organisation linked to a client.
export const MULTI_ORG_TIER: DashboardTier = "multi_company";
