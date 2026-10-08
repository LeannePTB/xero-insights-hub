# Fix "Unreconciled since" for Bangkok on King (and everyone)

## What is actually wrong

The 6 Oct on Bangkok on King is not from the new rule at all. It is the old value ("newest reconciled line"), saved this morning before the change. The new lookup (oldest line still not reconciled) has never run for any client yet, so every date in that column is still the old, misleading kind.

## What will change

1. **Stop showing old-rule dates.** Dates saved under the old rule are cleared, so the column shows "—" (not available yet) instead of a wrong date. A date only appears once it comes from the new lookup.
2. **Run the new lookup now for Bangkok on King**, then check that it finds lines going back to July. Other clients pick it up in tonight's refresh (one extra Xero call each, already budgeted).
3. **Tell you the result honestly.** If Bangkok's July lines show, the column will read 2 Jul.

## The one catch

Xero only shares bank lines with apps after someone has coded them in Xero ("spend money" / "receive money" lines waiting to be matched). Bank feed lines that nobody has touched yet stay hidden from apps. Xero does have a separate way to read those, but it needs special approval from Xero.

If Bangkok's July items are untouched feed lines, the app still can't see them after this fix. If that happens, the options are:
- A. Show "Unreconciled since" only as "at least since" with a hover note saying untouched feed lines aren't included.
- B. Apply to Xero for access to raw bank statement lines. This takes weeks and Xero may say no.
- C. Use the existing statement upload: upload Xero's unreconciled report, and the date comes from that.

I'll come back with what the July lines turned out to be before choosing.

## Technical details

- One migration: `update client_key_figures set bank_reconciled_to = null` for rows written before the `bank_unreconciled_oldest` snapshot existed for that tenant (no row has it yet, so effectively all). Data-only; no schema, policy, grant or function change.
- `key-figures.server.ts` already writes null when the new snapshot is missing, so old values cannot come back.
- Trigger the existing scheduled refresh for Bangkok on King only; then read `bank_unreconciled_oldest` and compare its oldest date against July.

## Security classification

Security-relevant (client Xero data, overnight refresh). No change to who can read or write anything; no new Xero scope; no new function. Will run `bun run security:check` and update `docs/security-backlog.md`.
