# Fix Loan Consolidation: empty account list + missing seeded pairings

## What's actually wrong

Two separate problems, both confirmed against the database:

1. **The Loan accounts tab shows nothing even though data exists.** There are 69 loan accounts stored across 12 Xero files in the DRTABT group (for example, A.C.N. 657 659 026 has 3 accounts), but the screen says "No loan accounts set up for this Xero file yet." The query that loads them asks the database to join through a link that doesn't exist between the loan accounts table and the Xero file link table, so the read fails silently and returns nothing. The failure is swallowed, which is why there is no error message.

2. **The seeded data is incomplete.** In the Hub app the DRTABT group has 22 saved pairings. In this project:
   - Zero pairings exist — every loan account has an empty counterparty.
   - TracyFinlay only has 1 loan account (805 Caravan Loan). The Hub shows TracyFinlay holding the other side of many pairs (870 X1 Enterprises PIT, 880 X3 Enterprises, 885 X4 Enterprises, etc.), so those accounts were never seeded.

## What I'll do

### 1. Fix the account list query
Replace the broken join with a straightforward lookup: read the loan accounts, then read the Xero file names separately and attach them in code. Apply the same fix everywhere that join is used (account list, tenant list with counts, and any matrix/recon read that uses it), and stop silently ignoring database errors so a future failure surfaces as a visible message instead of an empty table.

### 2. Restore the missing TracyFinlay loan accounts
Add the counterparty loan accounts TracyFinlay is missing so both sides of each intercompany loan exist.

### 3. Seed the 22 pairings for DRTABT
Link each pair (both directions) so the Matrix and mismatch views work. Pairs are matched on the account naming already in the data, e.g.:
```text
X1 Enterprises · 901 Loan - TracyFinlay   <->  TracyFinlay · 870 X1 Enterprises PIT
X3 Enterprises · 900 Loan - TracyFinlay   <->  TracyFinlay · 880 X3 Enterprises Pty Ltd
X4 Enterprises · 900 Loan - TracyFinlay   <->  TracyFinlay · 885 X4 Enterprises Pty Ltd
DRTABT Projects · 906 Loan - Tracy D&A to A.C.N. 657...  <->  A.C.N. 657... · 901 Loan - TracyD&A Pty Ltd
```

### 4. Verify
After seeding, check the Loan accounts tab lists accounts per Xero file with counterparties shown, and that the Matrix tab renders balances rather than an empty state.

## One thing I need from you

I can see the account names on both sides, so I can rebuild the pairs by matching names — but the Hub's exact 22-pair list is the source of truth. If you can paste (or screenshot) the full "Pairings in this group" list from the Hub, I'll seed exactly those. Otherwise I'll seed my best name-based match and show you the resulting list to confirm or correct.

## Technical notes

- Files touched: `src/lib/loan-consolidation.functions.ts` (embed removal + error surfacing), and `src/lib/loan-recon.server.ts` / `src/lib/loan-mismatch.server.ts` if they use the same embed.
- Data changes go in via data inserts/updates on `loan_consolidation_accounts` (new TracyFinlay rows, then `counterparty_account_id` set on both sides of each pair). No schema change needed.
