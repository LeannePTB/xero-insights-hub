# Explicit bank and credit-card classification

Classification: **security-relevant** — a new client-data setting and audited save function. No existing access rights, Xero settings or balances change.

## What changes
- Add **Bank accounts & credit cards** to the existing client settings page, listing accounts from the client's stored Xero account snapshot.
- Each account offers **Use Xero classification**, **Bank account**, or **Credit card**. Overrides apply only to that exact client, Xero file and account ID, never to account names.
- Organisation owners and active team members can save classifications using the existing client write predicate. External advisers, business-owner viewer grants, support grants and unrelated System Admin users cannot edit them. Existing authorised client readers can read the classifications needed to calculate their figures.
- Cash at bank totals bank accounts only. Net cash subtracts credit-card debt once. Genuine bank overdrafts remain bank balances; overpaid cards do not add bank cash or debt.
- Apply the same classification to overview, client figures, health calculations, cash-flow calculations and newly generated reports. Never regenerate final or sent reports, or rewrite historical balances.
- Saving immediately invalidates affected page reads. The overview still reads stored figures only; classification does not trigger extra Xero calls. Show the figures' actual date rather than implying they are live statement balances.

## Positive Traction
- Your screenshot identifies **Credit Card** as a card. Select that account explicitly in the new setting; do not infer this from its name.
- Screenshot Xero balances: $2,444.85 + $2,000.00 = **$4,444.85 cash at bank**; less $3,554.32 card debt = **$890.53 net cash**.
- Current stored snapshots may have an earlier Astro Visual balance. Reclassification corrects the split, not the freshness of the underlying Xero balance. Confirm the saved classification through the signed-in page; if second-factor verification blocks this, report it as unfinished rather than bypassing MFA.

## Technical details
- Add a client/file/account-keyed classification table with RLS, restrictive AAL2, no anonymous access and no direct user writes. Only explicit SELECT grants for authorised reads.
- Add one caller-scoped AAL2 audited save RPC. Resolve the Xero file's client ownership and validate the account ID against the stored accounts snapshot before saving. Use the existing database write predicate; never implement membership checks in TypeScript or use an admin client for this action.
- Extend the shared `src/lib/xero/tax-lines.ts` calculation boundary with explicit ID-keyed classifications; thread them through every affected consumer, failing visibly if the classification read fails.
- Add the setting alongside existing client account settings, reusing shared controls and the parent's management gate. Add the structural rule to `AGENTS.md`.
- Update the access matrix, database fixtures, function register and security backlog alongside the new objects.

## Verification
- Tests for your screenshot's exact arithmetic, Xero-mistyped card overrides, correct card metadata, overdrafts, overpaid cards, reset-to-Xero and unmatched/missing account data.
- Access tests: same-organisation owner/staff allowed; viewers, support, unrelated members, bare super admins, anonymous and AAL1 denied writes; cross-client/file account substitution denied; save audited.
- Run focused calculation and access tests and full `security:check`; inspect automatic build/typecheck results and database linter. Security posture requires an authorised AAL2 session; no tooling bypass.
- Verify save → reread → overview and client figures with a real signed-in account, or clearly report the MFA blocker.

## Not included
Trixie changes, new access exceptions, guessed classifications, Xero account changes, statement-balance substitution or unrelated security fixes.