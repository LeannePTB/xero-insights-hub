# Fix Net cash showing the same as Cash at bank

Classification: security-relevant (client financial figures, Xero calls). No access changes.

## What the data shows
- Bangkok on King's only stored daily-figures row was saved at 04:36 UTC today, before the credit-card fix. Its credit-card debt field is empty, so Net cash falls back to Cash at bank.
- That row also stores cash of $36,680, while the screenshot shows $21,784. So the overview may be reading cash from a second stored source. Not yet confirmed.

## Steps
1. Find which stored figure the overview uses for Cash at bank and Net cash, and confirm why the two disagree.
2. Refresh just Bangkok on King's Xero file once using the existing refresh, which takes about 25 calls. Then check that credit-card debt is saved.
3. If it is still empty, compare Bangkok's Xero bank accounts with the credit-card detection rule (account type CREDITCARD). Fix the detection so the card is found. Do not match on names.
4. Show Net cash as "—" with a tooltip when card debt hasn't been read yet, so it never just copies Cash at bank.
5. Add a test for this: cash minus card debt equals Net cash, and unknown card debt does not equal cash.
6. Run `bun run security:check` and the typecheck, and update the security backlog.

## Not changing
Access rules, the overnight refresh budget and other clients' rows.
