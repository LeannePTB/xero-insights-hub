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

// Scopes for "Sign In with Xero" — identity only, no organisation access.
// Per Xero docs (https://developer.xero.com/documentation/guides/oauth2/sign-up),
// `openid` is required; `profile` and `email` populate the id_token claims we
// use to match a Xero user back to an invited app user.
const XERO_IDENTITY_SCOPES = ["openid", "profile", "email"];

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

export function xeroIdentityScopeString() {
  return XERO_IDENTITY_SCOPES.join(" ");
}
