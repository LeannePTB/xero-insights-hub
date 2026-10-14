// Plain-English mapping of a Xero scope to the capability it unlocks.
// Used for reconnect prompts and "Reconnect to enable this" states.
export const SCOPE_CAPABILITIES: Record<string, string> = {
  "accounting.reports.trialbalance.read": "trial balance",
  "accounting.reports.aged.read": "aged receivables and payables",
  "accounting.banktransactions.read": "bank reconciliation detail",
  "assets.read": "fixed assets",
  "accounting.reports.balancesheet.read": "balance sheet",
  "accounting.reports.profitandloss.read": "profit and loss",
  "accounting.reports.banksummary.read": "bank summary",
  "accounting.reports.taxreports.read": "tax reports",
  "accounting.invoices.read": "invoices",
  "accounting.payments.read": "payments",
  "accounting.contacts.read": "contacts",
  "accounting.settings.read": "chart of accounts and organisation settings",
  "accounting.journals.read": "journals",
  "payroll.payruns.read": "pay runs",
  "payroll.payslip.read": "payslips",
  "payroll.employees.read": "payroll employees",
  "payroll.settings.read": "payroll settings",
};

export function capabilityFor(scope: string) {
  return SCOPE_CAPABILITIES[scope] ?? scope;
}

export function capabilityList(scopes: string[]) {
  const labels = [...new Set(scopes.map(capabilityFor))];
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
