## Plan

1. **Make the Xero callback URL explicit and consistent**
   - Update the Xero connect starter so it always builds the authorize URL with the canonical callback:
     `https://tractionadvisory.app/api/public/xero/callback`
   - Stop deriving the Xero `redirect_uri` from preview/editor origins.

2. **Make token exchange use the same callback URL**
   - Update the callback route so the token exchange sends the exact same `redirect_uri` that was sent to Xero during authorization.
   - This matters because Xero requires the authorize-step and token-step redirect URI to match exactly.

3. **Keep user return navigation separate from Xero redirect URI**
   - Store/keep the safe return origin for sending the user back to the dashboard.
   - Continue redirecting successful reconnects back to the live app dashboard.

4. **Add safer error visibility**
   - Log the non-secret redirect URI and Xero error code/status when authorization or token exchange fails.
   - Do not log tokens, secrets, or auth codes.

5. **Post-fix requirement outside code**
   - Xero must have this exact redirect URI registered in its app settings:
     `https://tractionadvisory.app/api/public/xero/callback`
   - If Xero currently only has the preview URL registered, the code fix alone will not connect until the live callback is added/allowed in Xero.