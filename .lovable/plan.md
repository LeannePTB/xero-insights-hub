## Plan

1. **Keep the reconnect flow on the domain the user started from**
   - Update the Xero OAuth start/callback handling so a reconnect started from `tractionadvisory.app` returns to `tractionadvisory.app`, not the preview URL.
   - Avoid sending users back to `/dashboard` on the preview host after callback errors.

2. **Make callback origin handling safer**
   - Preserve the original `return_origin` already stored in the OAuth state.
   - Use the stable registered callback only for Xero’s redirect URI when required, but redirect the browser back to the saved live origin after token exchange.

3. **Improve error redirects**
   - Ensure `invalid_state`, `token_exchange`, `tenants_lookup`, and database failures redirect back to the saved app origin where possible.
   - Keep the existing Xero error query params so the dashboard can still show a reconnect/error message.

4. **Verify the flow**
   - Check the generated Xero authorization URL from the live domain uses the expected callback and includes a saved return origin.
   - Confirm callback redirects back to the live/custom domain rather than `id-preview--...lovable.app`.

## Technical notes

- Likely files to change:
  - `src/lib/xero/connections.functions.ts`
  - `src/routes/api/public/xero/callback.ts`
- No database schema change expected.
- No changes to the dashboard cards themselves.