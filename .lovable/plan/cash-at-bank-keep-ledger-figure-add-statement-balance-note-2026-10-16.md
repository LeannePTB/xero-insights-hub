# Cash at bank: keep ledger figure, add statement-balance note

## Why the numbers differ (confirmed)

Xero shows two balances per bank account: the **statement balance** (last bank-feed import) and **Balance in Xero** (the ledger balance, including coded-but-unreconciled items). The app's Cash at bank / Net cash reads the Balance Sheet ledger balances — for Demo Company that is -12,023.26 + 6,878.28 = **-$5,145**, exactly what the Overview shows. The $13,472.70 gap is the 28 unreconciled items on the Business Bank Account. Not a bug; the app matches Xero's books.

## Decision

Keep the **ledger balance** as the figure everywhere (it is the accounting-correct number and the health rule, Overview, reports and Trixie must keep agreeing on one definition). Add a **secondary note** showing the bank statement position when it disagrees.

## Changes

1. **New pure extractor** in `src/lib/xero/` (alongside `tax-lines.ts`): read the already-snapshotted `bank_summary` report (fetched nightly, currently stored but unused) and pull each account's **statement balance and statement date**, matched to the same cash accounts via the existing ID-keyed bank-classification overlay — never name guesses. Credit cards excluded, same as cash. Returns `null` (no note) when the snapshot is missing, has no statement lines, or statement and ledger agree within a cent.
2. **Client dashboard cash card**: under the Cash at bank / Net cash figures, when the totals differ, show one small muted line, e.g. "Bank statements show $8,328 (14 Oct) — $13,473 not yet reconciled in Xero." Links nowhere new; the existing reconciliation dates/warning stay as they are.
3. **Overview row**: same note available to the Overview's cash cell (title/secondary line), driven by the same extractor — one implementation, shared.
4. **No changes** to: the ledger figure itself, net cash, protected money, the health rule, reports/PDFs, Trixie figures, or the reconciliation-date logic. Statement balance is display-only context; it never replaces the ledger number in any calculation.

## Technical notes

- `bank_summary` is already in the nightly snapshot (`src/lib/xero/snapshot-keys.ts`), so no new Xero calls and no rate-limit impact.
- Extractor is pure and unit-tested next to the existing tax-lines tests: per-account matching, missing snapshot, agreeing balances, credit-card exclusion, classification overlay applied.
- Presentation-only otherwise; no database, access or security changes.
- Verify: unit tests + `bun run security:check` unchanged; visual check on the Demo Company dashboard.
