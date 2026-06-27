export type XeroScopeSetId = "granular" | "broad";

const XERO_SCOPE_SETS: Record<XeroScopeSetId, string[]> = {
  // Current Xero Accounting API read-only scopes. Xero has been moving Web/PKCE
  // apps from the older umbrella scopes onto these granular scopes.
  granular: [
    "offline_access",
    "accounting.reports.balancesheet.read",
    "accounting.reports.banksummary.read",
    "accounting.reports.profitandloss.read",
    "accounting.reports.taxreports.read",
    "accounting.invoices.read",
    "accounting.payments.read",
    "accounting.settings.read",
  ],

  // Fallback for Xero apps that still accept the older broad read-only scopes.
  broad: [
    "offline_access",
    "accounting.reports.read",
    "accounting.transactions.read",
    "accounting.settings.read",
  ],
};

export const DEFAULT_XERO_SCOPE_SET: XeroScopeSetId = "granular";

export function xeroScopes(scopeSet: XeroScopeSetId = DEFAULT_XERO_SCOPE_SET) {
  const scopes = XERO_SCOPE_SETS[scopeSet];
  for (const scope of scopes) {
    if (scope !== "offline_access" && !scope.endsWith(".read")) {
      throw new Error(`Forbidden Xero scope detected: ${scope}. Only read-only scopes are allowed.`);
    }
  }
  return scopes;
}

export function xeroScopeString(scopeSet: XeroScopeSetId = DEFAULT_XERO_SCOPE_SET) {
  return xeroScopes(scopeSet).join(" ");
}

export function xeroStateForScopeSet(scopeSet: XeroScopeSetId, randomHex: string) {
  return `${scopeSet === "granular" ? "g" : "b"}_${randomHex}`;
}

export function xeroScopeSetFromState(state: string | null | undefined): XeroScopeSetId {
  if (state?.startsWith("b_")) return "broad";
  if (state?.startsWith("g_")) return "granular";
  return DEFAULT_XERO_SCOPE_SET;
}

export function alternateXeroScopeSet(scopeSet: XeroScopeSetId): XeroScopeSetId | null {
  return scopeSet === "granular" ? "broad" : null;
}