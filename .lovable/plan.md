# Make Loan accounts screen match the Hub's "Loan Account Pairings"

## What's different today

Traction Advisory's **Loan accounts** tab is a per-file account list: pick one Xero file, see its loan accounts, set a direction, and choose a counterparty from a dropdown on each row. The Hub screen is pairing-first: you build a pairing from two sides (Xero file + loan account on each), save it, and every pairing in the group is listed together with a count.

## What to build

Rebuild the tab so it works exactly like the Hub:

**Header** — "Loan Account Pairings" with the sub-line "Match a loan account in one Xero file with its counterparty in another. Both sides show the full liability + asset account list so you can line them up."

**Group card** — group selector showing the group name and the number of Xero files in it, e.g. `DRTABT (12)`.

**Add pairing card** — two side-by-side panels (Side A / Side B), each with a "Xero file" select and a "Loan account" select that stays disabled with the hint "Pick Xero file first" until a file is chosen. A swap button between the panels flips the two sides. "Save pairing" is disabled until both sides are complete.

**Pairings in this group** — a table of Side A / Side B with the pairing count on the right of the header, each row showing entity name plus `code · account name` on both sides, and edit / delete actions. Edit loads the pairing back into the builder; delete unlinks it.

The loan-account dropdowns list all active liability and asset accounts from the chosen Xero file (bank accounts excluded), so accounts that aren't yet tracked can be paired directly.

## Technical notes

- Rewrite `src/routes/_authenticated/firms.$firmId.loans.accounts.tsx` around a pairing model instead of the current per-file row editor.
- Add server functions in `src/lib/loan-consolidation.functions.ts`:
  - `listGroupLoanPairings({ groupId })` — reads `loan_consolidation_accounts` across the group's clients and returns deduplicated two-sided pairings (id, tenant name, code, name for each side).
  - `saveLoanPairing({ groupId, a: { clientId, tenantId, account }, b: { ... }, replacePairId? })` — upserts each side into `loan_consolidation_accounts` if the account isn't already tracked, then links both `counterparty_account_id` values in one call. Reuses the existing `canManageClient` check and admin client, same as `pairLoanAccounts`.
- Keep `listGroupLoanFiles` for the file dropdowns and `listLiabilityAccountsForTenant` for the account dropdowns.
- Existing `unpairLoanAccount` / `deleteLoanAccount` back the delete action; the 22 seeded DRTABT pairings stay intact because the data model is unchanged.
- "Auto-detect from Xero" stays available as a secondary action in the Add pairing card.
