## Problem

The Cash Flow widget calls two Xero endpoints that aren't covered by our current OAuth scopes:

- `Reports/BankSummary` → requires `accounting.reports.read`
- `Accounts` (bank account list) → requires `accounting.settings.read`

Our current scope list only has P&L / BalanceSheet / TaxReports / Invoices `.read`. So the API returns 401 → the widget shows "needs to be reconnected", and clicking Reconnect doesn't help because the consent screen never asks Xero for the new scopes.

## Fix

1. **Add the missing read-only scopes** to `SCOPES_ARRAY` in `src/lib/xero/connections.functions.ts`:
   - `accounting.reports.read`
   - `accounting.settings.read`
   Both are `.read`, so they pass the read-only safety check.

2. **Force a fresh consent** so Xero re-issues a token with the new scopes. After deploy, you'll need to disconnect + reconnect the org once (existing refresh tokens are scoped to the old list).

3. **Add a scope-hint entry** in `MISSING_SCOPE_HINTS` for `Reports/BankSummary` and `Accounts` so future scope drift surfaces a clear "needs reconnect" message instead of a raw 401.

## Missing widget icons

You mentioned "some cards / widgets don't have little icons." I need to know which ones you mean before I touch them — the dashboard has ~10 widgets and most don't currently have a header icon. Two reads of the request:

(a) Add a small icon next to every widget title (e.g. Cash Flow → Wallet, P&L → LineChart, Tax → Receipt, Super → PiggyBank, Receivables → ArrowDownToLine, Payables → ArrowUpFromLine, Break-even → Target, Health → Activity, Notes → StickyNote, Unreconciled → AlertCircle).

(b) You're looking at a specific card or two that's missing an icon another card has — tell me which and I'll match it.

I'll default to **(a)** — add a consistent lucide icon to every widget header — unless you tell me otherwise in your reply.

## Files touched

- `src/lib/xero/connections.functions.ts` — extend `SCOPES_ARRAY`
- `src/lib/xero/api.server.ts` — add scope hints for `Reports/BankSummary` and `Accounts`
- Each widget header in `src/components/dashboard/*Widget.tsx` (if option a) — add a leading lucide icon next to the `<h3>` title

## After deploy

Open Client settings → Xero connection → Disconnect → Reconnect, and approve the new permissions on the Xero consent screen. Then Cash Flow will load.