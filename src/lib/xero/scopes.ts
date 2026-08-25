// Xero scopes.
//
// There is exactly ONE source of truth for the read scopes the product needs:
// `public.xero_required_scopes()` in the database. `xero_missing_scopes(uuid)`
// compares granted scopes against it, and the authorisation URL is now built
// from it too (see `scopes.server.ts`). Do NOT reintroduce a TypeScript copy of
// the list here — that drift is what stopped `accounting.manualjournals.read`
// from ever being requested.
//
// Read-only only: Traction Advisory never writes to a client's Xero file.

// Scopes for "Sign In with Xero" — identity only, no organisation access.
// Per Xero docs (https://developer.xero.com/documentation/guides/oauth2/sign-up),
// `openid` is required; `profile` and `email` populate the id_token claims we
// use to match a Xero user back to an invited app user. These are not
// accounting scopes and are deliberately not part of the required-scope list.
const XERO_IDENTITY_SCOPES = ["openid", "profile", "email"];

/**
 * Guard: reject anything that is not read-only. Applied to whatever the
 * database returns, so a bad row in `xero_required_scopes()` can never turn
 * into a write-capable authorisation request.
 */
export function assertReadOnlyScopes(scopes: string[]): string[] {
  for (const scope of scopes) {
    if (scope !== "offline_access" && !scope.endsWith(".read")) {
      throw new Error(`Forbidden Xero scope detected: ${scope}. Only read-only scopes are allowed.`);
    }
  }
  return scopes;
}

export function xeroIdentityScopeString() {
  return XERO_IDENTITY_SCOPES.join(" ");
}
