# One "Account setup" tab

Classification: SECURITY-RELEVANT (moves stored tags into a new table; new definer functions; new audited saves). Access rules stay identical.

## Superannuation bug (Demo Company) — likely cause
The Cost classification list is built only from accounts with P&L activity in the last 12 months, not from the chart of accounts. "478 Superannuation" is in the chart (EXPENSE, ACTIVE) but has no posted amounts in that window, so it never appears. It is not filtered by the super/statutory rules. This will be confirmed against the stored P&L snapshot before the build starts. The new tab lists every ACTIVE expense / direct-cost account from the chart, so the bug goes away.

## What the user sees
- Client settings gets a new "Account setup" tab. It replaces the Cost classification tab, the GST/PAYG/super tick boxes on Tax & reporting, and the bank choices on Banks & accounts. Any other settings on those tabs stay where they are.
- One list in three groups, with one dropdown per account:
  - Bank & cash (Xero BANK accounts): Cash at bank · Credit card · Not cash
  - Tax & super (liability accounts only, matched on Class/Type first, then name words like GST, BAS, ATO, PAYG, withholding, super, ICA, suspense or clearing, plus anything already tagged): GST · PAYG withholding · GST + PAYG · Super owed · Not a tax account. A "+ Add another account as a tax account" picker covers the rest.
  - Costs (every active expense / direct-cost account): Wages · Fixed cost · Variable cost · Leave out. Wages rows get a "casual / varies with sales" switch; without it, wages count as fixed. Accounts with no activity in 12 months sit in a collapsed "No recent activity" list and can still be tagged.
- Suggestions instead of "Unclassified": each row is pre-filled from Xero's type and name, with a "suggested" badge until someone confirms it. Superannuation, workers comp and payroll tax expense accounts are suggested as Wages. Buttons: "Accept all suggestions" per group and overall. Filter: Needs a decision · All · Changed by hand. Progress: "12 of 14 done". The setup checklist counts unconfirmed suggestions.
- Old links (#cost-classification, the statutory section, the bank section and the old Cost classification address) open the new tab at the right group.

## Storage and migration
- New table `client_account_setup`: client_id, tenant_id, account_id (Xero AccountID), group (bank|tax|cost), value, wages_variable, confirmed, account_name snapshot, updated_by, updated_at; unique on (client_id, tenant_id, account_id).
- RLS on. Access is revoked from anon and authenticated. Writes go only through one AAL2, caller-scoped, audited definer function using the existing write predicate (`app_private.user_can_write_client`). Reads use the same read predicate as the three current tables. The function writes one audit row per change, with old → new values.
- Migration copies every existing row from the three tables:
  - Bank rows are already keyed by AccountID, so they copy directly.
  - Statutory and cost rows are matched by name to an AccountID through the stored 'accounts' snapshot. A live Accounts read through the existing gate is used only where a snapshot is missing.
  - Human choices migrate as confirmed. `is_wages` becomes Wages, and the account's old fixed/variable tag sets the casual switch, so the maths stays the same.
  - Rows that can't be matched are kept in a holding state and shown as "Account not found in Xero". Nothing is dropped.
- The three old tables stay. They become read-only for one release: write grants and policies are removed, the tables get a "deprecated" note, and no data is deleted.

## One reader for everything
`account-setup.server.ts` gives one resolver that returns cash/card/excluded, tax category, and cost class/wages. It counts confirmed rows only; unconfirmed suggestions fall back to today's seeded behaviour, so figures stay the same until someone confirms. These all switch to it: Business Health (wages, cash), break-even, Cash flow scenario, the Tax obligations / GST / PAYG / super cards, Overview protected money and cash, the monthly report (new drafts only), Trixie, and the wages split.

## Figures-unchanged proof
A script computes key figures for every client from stored snapshots, before and after (cash at bank, card debt, GST/PAYG/super owed, wages, fixed/variable totals, break-even, net profit). It diffs the two and the report lists every difference with its cause. Expected differences: none.

## Checks
- Tests: the reader prefers confirmed rows; a suggestion doesn't change figures; wages fixed by default and variable when casual; super expense vs super liability grouping; migration matching and the unmatched list; Business Owner / Viewer / System Admin / other-organisation can't read or save; saves fail at AAL1.
- Run tsgo, build, `vitest tests/`, `bun test src` and `security:check`. Update the access matrix, definer register and security backlog. Also run a desktop and mobile check (the screens need a signed-in, two-step-verified session).
- The report back covers migration counts per client, unmatched accounts, the super cause and any figure differences.

## Question for the owner (default assumed)
Making the old tables read-only means old code paths can't write to them. I'll assume that's fine because every screen moves to the new tab in the same change.
