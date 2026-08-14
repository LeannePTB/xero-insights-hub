# Fix "What this client sees" — plan should unlock all its cards

## What's wrong

Two separate problems, both confirmed:

1. **The card list is wrong.** In the tier catalogue, the "Advisory" and "Multi company" dashboard tiers have an **empty card list** saved against them; only "Standard" has cards (Business Health, Aged Receivables, Aged Payables, Profit & Loss, Unreconciled). So even though this organisation's plan includes Standard + Advisory + Multi company, the only cards the system can offer are Standard's five — everything else shows "Not in your plan". Advisory and Multi company also share the same rank number, so their order is ambiguous.

2. **"Edit plan defaults" is visible to organisations.** That link sends anyone to the global tier settings page, which is a super-admin-only area. It should not be shown to organisation owners/staff at all.

## The fix

**Card lists for the tiers**
- Give "Advisory" its full card list: Business Health, Aged Receivables, Aged Payables, Profit & Loss, Unreconciled Transactions, Tax Liabilities, Superannuation Liabilities, Accounting Break-Even, True Break-Even (Cash), Cash Flow, Xero File Audit.
- Give "Multi company" every card, including Cashflow Scenario and Loan Consolidation.
- Give the two tiers distinct ranks (Standard, then Advisory, then Multi company) so the cumulative "higher tier includes everything below it" rule resolves cleanly.

Result for this organisation: every card is selectable and, because it has no custom selection saved, all of them are ticked by default.

**Safety net so this can't silently recur**
- When a dashboard tier in the catalogue has an empty card list, treat it as "no cards of its own" but never let it shrink what lower tiers already grant (already the behaviour) — and additionally, if the whole resolved list ends up empty, fall back to the built-in defaults rather than showing a stripped panel.

**Hide the super-admin link**
- Remove the "Edit plan defaults" link from the client settings panel for everyone except super admins.

## Technical notes

- Data migration updating `plan_levels` rows with `scope = 'dashboard'`: set `widgets` for `advisory` and `multi_company`, and set `sort_order` to 10 / 20 / 30 for `basic` / `advisory` / `multi_company`.
- `src/routes/_authenticated/clients.$clientId.settings.tsx` (~line 852): gate the `Link to="/settings/tiers"` behind the existing super-admin check used elsewhere on that page.
- No change needed to `cumulativeDashboardLevels` in `src/lib/plan-tiers.ts`; the ceiling logic works once ranks are distinct.
