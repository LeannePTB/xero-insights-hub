# Reword the all-clear verdict and respect GST/PAYG registration

## Problem

The all-clear verdict on the monthly report always says:

> "We reviewed protected money held against cash at bank, the statutory balances carried on the Balance Sheet, and the ageing and concentration of the debtor book."

For a client not registered for GST or PAYG there is no protected money to review, so the sentence is wrong for them — and the wording is stilted for everyone.

## Change

Classification: not security-relevant — verdict wording and which checks are named in it. No access rules, policies, grants, predicates or payload shape change (the verdict fields are recomputed on each generate; `MONTHLY_REPORT_PAYLOAD_VERSION` untouched).

In `src/lib/health/rules.server.ts` (`evaluateFromRows`), build the "ok" detail from the `expected` settings already computed there:

- **All clients** — keep the label "Nothing required attention this month", but reword the detail plainly.
- **Registered for GST or withholding PAYG:** "This month we checked the money set aside for tax and super against cash at bank, and the ageing and concentration of the accounting file. Nothing needed attention."
- **Registered for neither:** the protected-money clause is dropped entirely: "This month we checked the ageing and concentration of the accounting file. Nothing needed attention."
- **GST registered, PAYG not withheld** (or vice versa): only the applicable item is named — "the GST set aside against cash at bank" or "the tax withheld from wages and super against cash at bank".

No mention of protected money appears when none is expected. The "partial" and "issues" verdicts are untouched.

## Verification

- New test in `src/lib/health/rules.test.ts`: a client registered for neither GST nor PAYG with a clean file gets the "ok" state with no mention of protected money or statutory balances.
- `bunx tsc --noEmit`, `bun run security:check` (54+ tests, live access 18/0/0).
- Backlog note appended to `docs/security-backlog.md`.
- Applies to reports generated from now on; regenerate a draft to see it.
