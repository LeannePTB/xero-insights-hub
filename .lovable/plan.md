## Plan to fix Xero reconnect properly

1. **Restore the known-good Xero OAuth permissions**
   - Remove the experimental granular/broad fallback flow.
   - Use only the standard scopes that were working before:
     - `offline_access`
     - `accounting.reports.read`
     - `accounting.transactions.read`
     - `accounting.settings.read`
     - `accounting.contacts.read`
   - Do not request any invalid or experimental granular report scopes.

2. **Simplify the callback error path**
   - If Xero returns `invalid_scope`, stop retrying with another scope set.
   - Redirect back to the client settings/dashboard with a clear message that the Xero app rejected the requested permissions.
   - Keep the existing production callback URL: `https://tractionadvisory.app/api/public/xero/callback`.

3. **Remove state-prefix complexity**
   - Generate normal OAuth state values again instead of `b_...` / `g_...` values.
   - Keep PKCE and stored return origin behavior intact.

4. **Verify the actual generated authorize URL**
   - Confirm the URL sent to Xero contains no invalid scopes.
   - Confirm the `redirect_uri` is still the production callback URL.
   - Confirm no dashboard widget asks the OAuth flow for extra scopes directly.

5. **Keep widget icons separate from reconnect**
   - Do not add more dashboard/widget changes while fixing reconnect.
   - Once reconnect works again, audit any missing widget icons as a separate safe change.