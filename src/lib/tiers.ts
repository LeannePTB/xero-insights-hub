export type DashboardTier = "basic" | "advisory" | "investigate" | "multi_company";
export type WidgetKey =
  | "health"
  | "receivables"
  | "payables"
  | "pnl"
  | "notes"
  | "unreconciled"
  | "tax_liability"
  | "superannuation"
  | "accounting_breakeven"
  | "true_breakeven"
  | "cashflow"
  | "cashflow_scenario"
  | "xero_audit"
  | "loan_consolidation"
  | "balance_sheet_reconciliation"
  | "fixed_assets_reconciliation"
  | "gst_reconciliation"
  | "transaction_search";


export const ALL_WIDGETS: WidgetKey[] = [
  "health",
  "receivables",
  "payables",
  "pnl",
  "notes",
  "unreconciled",
  "tax_liability",
  "superannuation",
  "accounting_breakeven",
  "true_breakeven",
  "cashflow",
  "cashflow_scenario",
  "xero_audit",
  "loan_consolidation",
  "balance_sheet_reconciliation",
  "fixed_assets_reconciliation",
  "gst_reconciliation",
  "transaction_search",
];

// Fallback defaults (used only if the DB has no row for a tier).
const ADVANCED: WidgetKey[] = [
  "health",
  "receivables",
  "payables",
  "pnl",
  "notes",
  "unreconciled",
  "tax_liability",
  "superannuation",
  "accounting_breakeven",
  "true_breakeven",
  "cashflow",
  "cashflow_scenario",
  "xero_audit",
  "loan_consolidation",
  "balance_sheet_reconciliation",
  "fixed_assets_reconciliation",
  "gst_reconciliation",
  "transaction_search",
];
export const DEFAULT_TIER_WIDGETS: Record<DashboardTier, WidgetKey[]> = {
  basic: ["health", "receivables", "payables", "pnl", "notes", "unreconciled"],
  advisory: ADVANCED,
  investigate: ADVANCED,
  multi_company: ADVANCED,
};

export const TIER_LABEL: Record<DashboardTier, string> = {
  basic: "Standard",
  advisory: "Advisory",
  investigate: "Investigate the Numbers",
  multi_company: "Multi company",
};

export const TIER_DESCRIPTION: Record<DashboardTier, string> = {
  basic: "Health, receivables, payables, P&L and unreconciled transactions.",
  advisory: "Everything in Standard plus tax, super and break-even analysis.",
  investigate: "Full advisory view across one Xero organisation.",
  multi_company: "Full dashboard across the number of Xero organisations allowed for this subscription.",
};

export const WIDGET_LABEL: Record<WidgetKey, string> = {
  health: "Business Health",
  receivables: "Aged Receivables",
  payables: "Aged Payables",
  pnl: "Profit & Loss",
  notes: "Notes",
  unreconciled: "Uncoded Bankfeed Questions",
  tax_liability: "Tax Liabilities",
  superannuation: "Superannuation Liabilities",
  accounting_breakeven: "Accounting Break-Even",
  true_breakeven: "True Break-Even (Cash)",
  cashflow: "Cash Flow",
  cashflow_scenario: "Cashflow Scenario",
  xero_audit: "Xero File Audit",
  loan_consolidation: "Loan Consolidation",
  balance_sheet_reconciliation: "Balance Sheet Reconciliation",
  fixed_assets_reconciliation: "Fixed Assets Reconciliation",
  gst_reconciliation: "GST Reconciliation (indicative)",
  transaction_search: "Transaction Search",
};

export const ALL_TIERS: DashboardTier[] = ["basic", "advisory", "investigate", "multi_company"];

// Legacy constant. Multi-org capability is driven by the catalogue flag
// `allows_multi_org` on each dashboard tier row, not by this key.
export const MULTI_ORG_TIER: DashboardTier = "multi_company";

/** Catalogue-safe lookups: tier keys are super-admin editable (e.g. multi_10). */
export function tierLabel(key: string, catalogueLabel?: string | null): string {
  // The catalogue is the source of truth — built-ins are only a fallback for
  // seeded keys that predate the editable tier list.
  return catalogueLabel ?? (TIER_LABEL as Record<string, string>)[key] ?? key;
}
export function tierDescription(key: string, catalogueDescription?: string | null): string {
  return catalogueDescription ?? (TIER_DESCRIPTION as Record<string, string>)[key] ?? "";
}
export function defaultWidgetsFor(key: string): WidgetKey[] {
  return (DEFAULT_TIER_WIDGETS as Record<string, WidgetKey[]>)[key] ?? DEFAULT_TIER_WIDGETS.basic;
}
