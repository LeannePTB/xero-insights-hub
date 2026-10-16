# Stop dashboard cards re-loading when today's figures are already saved

## Why it happens
Only a few cards (unpaid invoices/bills, rent, payroll) read last night's saved figures. Most others (Profit & Loss, Cash flow, GST, Tax, Break-even, Bookkeeping checks) still ask Xero live every time the dashboard opens, and Receivables/Payables re-ask every 3 minutes. While those calls queue behind our Xero rate protection, the card shows the spinning arrows in your screenshot.

## What will change
1. Confirm first: open Demo Company's dashboard and record which card spins, how many Xero calls it makes and how long each waits. The exact card is confirmed before any change.
2. Saved figures first: every dashboard card shows the newest saved figures (nightly or after a manual Refresh) straight away, with the existing "as at" freshness line. Xero is only asked live when there is no saved copy for that period, or when someone presses Refresh.
3. No background re-asking: remove the 3-minute automatic refresh on Receivables/Payables. Figures update on the nightly save or on Refresh.
4. Shared 10-minute cache (added yesterday) is extended to the remaining reference reads the cards use, so two cards wanting the same report make one Xero call.
5. Spinner only when really waiting: a card with saved figures never shows the loading arrows. A card with nothing saved shows "Waiting for Xero — loading shortly" as today.

## Not changing
- Who can see which client or card. Access checks still run on every request before saved or cached figures are returned.
- Final and sent reports.
- The figures themselves: saved figures are the same Xero reports, just read from storage.

## Technical details
- Add snapshot-first reads (via `readSnapshot`, keyed by tenant + report + period) to the server functions behind PnlWidget, CashflowWidget, GstReconciliationWidget, TaxObligationsWidget, useBreakevenData and the bookkeeping-checks card; fall back to live `xeroGet` only on a missing snapshot or `refresh: true`.
- Drop `refetchInterval` in ReceivablesWidget/PayablesWidget; raise `staleTime` to match snapshot age.
- RefreshSnapshotsButton passes `refresh: true` and invalidates the card queries.
- Measure Xero calls per dashboard open before/after from `audit_log`/request logs; add tests for "snapshot present → no live call".
- Run tsgo, build, tests and `bun run security:check`; update `docs/security-backlog.md`.
