## Add duplicate payment detection to the Xero file audit

Extend the existing Xero file audit with a new rule that flags likely double payments — useful for catching bills paid twice or customer payments recorded twice.

### What gets detected

A new **AP/AR** category rule `payments.possible_duplicate` (severity: **high**) flags any two or more payments that share:
- Same contact (vendor or customer)
- Same amount (to the cent)
- Same bank account
- Payment dates within **30 days** of each other
- Not already linked to the same invoice (so a legitimate split-invoice payment isn't flagged)

Each finding lists the payment IDs, dates, amount, contact, and a deep link to the first payment in Xero. Like all audit findings, it can be snoozed per tenant.

A secondary, lower-severity rule `payments.cross_account_duplicate` (severity: **medium**) catches the same contact + same amount within 30 days **across different bank accounts** (covers the "paid from personal card then again from business" pattern).

### Implementation

1. **`src/lib/xero/audit/rules.server.ts`** — add `rulePayments(payments, shortCode)`. Group by `Contact+Amount(+Account)`, sort by date, walk pairs within the 30-day window.
2. **`src/lib/xero/audit/deeplinks.ts`** — add `Payment` entity deep link.
3. **`src/lib/xero/audit.functions.ts`** — fetch `Payments` (last 12 months, `Status=AUTHORISED`) in parallel with existing fetches; call `rulePayments` and merge findings.
4. **Audit page** — no UI change; new findings appear under the AR/AP category filter.

### Notes / limits

- Only **AUTHORISED** payments considered (DELETED ignored).
- 12-month lookback to bound API size.
- Multiple payments against the **same invoice** are excluded so part-payments aren't false positives.
