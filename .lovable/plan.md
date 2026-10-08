# Fix "Bank reconciled to" date

Classification: SECURITY-RELEVANT (Xero API call and a client-data table). No change to who can see or change anything.

## Why it's wrong
The nightly refresh asks Xero for the **newest reconciled** bank transaction (`IsReconciled==true`, newest first). Reconciling one recent line moves the date forward, even when older lines (Bangkok on King, from 2 July) are still open. So the column shows the latest activity, not how far the bank is truly reconciled.

## Change
1. Swap the Xero request for the **oldest unreconciled** bank transaction (`IsReconciled==false`, oldest first, first page only). Still one call per file per night, same budget.
2. Show it as "Unreconciled since" (e.g. "2 Jul"). If nothing is unreconciled, show "Up to date".
3. The 14-day warning (cash caution marks and "What changed" item) uses this oldest-open date instead.
4. Wipe the stored dates that came from the old rule so the wrong 6 Oct doesn't show. Fresh dates fill in from the next refresh (I can run one for you straight after).

## Honest limit
Xero only hands over bank lines that have already been coded or matched in Xero. Raw bank-feed lines nobody has touched yet are not visible to apps through Xero's standard API. So if the 2 July items have never been coded, this may still read later than 2 July. I'll check Bangkok on King against your 2 July after the refresh and tell you exactly what it shows. If it misses them, the fallback is to show the date of the last bank-feed line received alongside, clearly labelled.

## Technical details
- `src/lib/xero/snapshot-keys.ts`: params `{ where: "IsReconciled==false", order: "Date ASC" }`; rename key to `bank_unreconciled_oldest` (old key kept out of the reader).
- `src/lib/overview/key-figures.server.ts` + shared staleness rule: read the new key; empty result = up to date.
- Migration: null `client_key_figures.bank_reconciled_to` (or new column `bank_unreconciled_since`); no policy/grant change.
- Update overview column label, tests for the 14-day rule, security backlog; run `bun run security:check`.
