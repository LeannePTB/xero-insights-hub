## What the issue is

Xero is failing before it redirects back to our app. That means the problem is in the **authorize URL** sent to Xero, not the token exchange or dashboard card loading.

Xero’s current docs say Web/PKCE apps have now been assigned **granular Accounting API scopes**, while the broad scopes we just restored (`accounting.reports.read`, `accounting.transactions.read`) are deprecated and may be rejected depending on the Xero app setup.

**Do I know what the issue is?** Yes: the reconnect flow is still requesting the wrong style of scopes for this Xero app. The previous “fallback” approach also could not help because Xero is showing an identity error page before our callback route receives anything.

## Plan to fix it

1. **Switch Xero OAuth to the current granular scope list**
   - Replace the broad scopes with Xero’s documented granular read scopes needed by the widgets:
     - `offline_access`
     - `accounting.reports.balancesheet.read`
     - `accounting.reports.banksummary.read`
     - `accounting.reports.profitandloss.read`
     - `accounting.reports.taxreports.read`
     - `accounting.invoices.read`
     - `accounting.payments.read`
     - `accounting.settings.read`
     - `accounting.contacts.read`
   - Do **not** include `accounting.reports.tenninetynine.read`.
   - Do **not** include deprecated broad scopes in the authorize URL.

2. **Remove the broad/granular retry concept completely**
   - Since Xero errors before callback, callback-based retry is ineffective.
   - Keep one clean scope list only.

3. **Add safe OAuth diagnostics**
   - Log the non-secret OAuth metadata when starting Xero connect:
     - redirect URI
     - exact scope string
     - return origin
   - Do not log client secret, tokens, auth codes, or refresh tokens.

4. **Improve user-facing Xero errors**
   - If Xero does return to our callback with `invalid_scope`, show a message that the app is using granular read-only scopes and the Xero app settings may need those scopes enabled/assigned.
   - If Xero never calls back and shows its own identity error page, the generated URL diagnostics will confirm whether the issue is scope or redirect URI.

5. **Verify references**
   - Confirm no invalid scope remains in the codebase.
   - Confirm the generated authorize URL uses:
     - `https://tractionadvisory.app/api/public/xero/callback`
     - granular scopes only
   - Check the current runtime import error separately so the preview is not hiding the real result.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>