# Replace "unexplained" with a plain-language reason when the GST figures don't tie

## What changes

When the activity-statement card's figures don't tie, the red "X unexplained" chip is replaced with an explanation of *why*, and clients (who see the card without the preparer detail) get their own plain-language version.

**Preparer view (advisors, "Check the figures tie"):**
- Chip reads "doesn't tie by $X" instead of "unexplained".
- A new "Why it doesn't tie" block inside the expanded detail lists each applicable reason in plain English:
  - *Manual journals we can't read* — shown whenever the journals-missing issue fired; names the limitation ("Xero doesn't let us read manual journals") and notes the difference is consistent with journals posted straight to the GST account.
  - *Rounding on the lodged form* — shown when the card's GST figures differ from whole-dollar BAS-style rounding.
  - *Timing* — shown when account movements include items dated near the period boundary (payments to the ATO dated after period end).
- The existing arithmetic panel and transactions table stay exactly as-is.

**Client view (non-advisors):**
- A compact amber note under the estimated payable figure: "These figures don't fully tie to the balance sheet — most likely because of manual journals we're not able to read. Your adviser can see the detail." Shown only when the tie fails; hidden entirely when it ties or when the data is complete.
- No balances, no arithmetic, no transaction list exposed to clients.

## Technical details

- Classification: presentation + derived data on a client-data surface. No new table, policy, grant or predicate; the data flows through the existing `getGstReconciliation` server function (requireAal2, existing read gate) — SECURITY-RELEVANT, invariant 6 honoured (no new authorisation logic in TypeScript).
- `src/lib/xero/gst.server.ts`: build a `tieReasons: string[]` (or a small typed list) alongside the existing `difference`/`ties` result, from signals already computed: `journalsMissing`, rounding gap between line-level GST and whole-dollar totals, and movements dated after `to`. No extra Xero calls, no ManualJournals scope changes.
- `src/components/dashboard/GstReconciliationWidget.tsx`: swap the chip wording; render the reasons list inside the advisor detail; render the client-safe note when `!showWarnings && !data.ties`.
- No change to PDF, reports, or any other card.

## Verification

- Fixture fingerprint match; access matrix re-rendered with 0 failures; 54/54 tests; live access suite 18/0/0; typecheck clean; linter unchanged.
- Security report with classification, invariants touched, and backlog updated.
