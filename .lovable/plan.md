## Plan

1. **Fix the invalid Xero scope**
   - Remove `accounting.reports.tenninetynine.read` from the OAuth scope list because it is not a valid Xero OAuth scope and is causing `invalid_scope`.
   - Keep the valid read-only scopes needed by the current widgets:
     - `offline_access`
     - `accounting.reports.read`
     - `accounting.settings.read`
     - `accounting.transactions.read`
     - `accounting.contacts.read`

2. **Improve the reconnect error handling**
   - If Xero sends `invalid_scope` back to `/api/public/xero/callback`, redirect the user with a clearer reconnect error instead of the generic failure.
   - Make the dashboard/settings message explain that the app scope list was updated and the org needs to be reconnected once.

3. **Audit widget header icons**
   - Check the dashboard widget registry/components for cards missing header icons.
   - Add matching icons only to cards that currently have none, keeping the existing card layout unchanged.

4. **Validate the flow**
   - Confirm the generated Xero authorize URL no longer contains invalid scopes.
   - Confirm the dashboard components still import cleanly after icon additions.

## Technical note

The likely immediate break is this scope in `src/lib/xero/connections.functions.ts`:

```text
accounting.reports.tenninetynine.read
```

Xero does not accept that OAuth scope in the standard Accounting API flow, so the authorize step fails before reconnect can complete.