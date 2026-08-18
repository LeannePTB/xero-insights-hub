// The set of Xero scopes we request at authorisation time. Read-only only —
// Traction Advisory never writes to a client's Xero file.
// The database is the source of truth for what the product *requires*
// (`public.xero_required_scopes()` / `public.xero_missing_scopes(uuid)`);
// this list exists solely to build the authorise URL.
const XERO_SCOPES = [
  "offline_access",
  "accounting.settings.read",
  "accounting.contacts.read",
  "accounting.invoices.read",
  "accounting.payments.read",
  "accounting.banktransactions.read",
  "accounting.reports.balancesheet.read",
  "accounting.reports.banksummary.read",
  "accounting.reports.profitandloss.read",
  "accounting.reports.trialbalance.read",
  "accounting.reports.aged.read",
  "accounting.reports.taxreports.read",
  "assets.read",
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
