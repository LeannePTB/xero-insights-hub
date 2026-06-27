const XERO_SCOPES = [
  "offline_access",
  "accounting.reports.balancesheet.read",
  "accounting.reports.banksummary.read",
  "accounting.reports.profitandloss.read",
  "accounting.reports.taxreports.read",
  "accounting.invoices.read",
  "accounting.payments.read",
  "accounting.settings.read",
  "accounting.contacts.read",
];

export function xeroScopes() {
  const scopes = XERO_SCOPES;
  for (const scope of scopes) {
    if (scope !== "offline_access" && !scope.endsWith(".read")) {
      throw new Error(`Forbidden Xero scope detected: ${scope}. Only read-only scopes are allowed.`);
    }
  }
  return scopes;
}

export function xeroScopeString() {
  return xeroScopes().join(" ");
}