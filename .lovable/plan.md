# File capability profile + widget merges

Plan only. Nothing below has been built. No database object, entitlement, tier, plan or RLS change is proposed except where explicitly flagged for your approval (there is exactly one such flag, in Part A item 4).

## Part A — capability profile

### 1. The flags and their derivation

Computed from stored snapshots only: `organisation`, `accounts`, `balance_sheet`, `invoices_accrec_open`, `invoices_accpay_open`. Zero Xero calls.

- `hasGst` — high confidence. `organisation.Class !== "NON_GST_CASHBOOK"` AND (`PaysTax === true` OR a `balance_sheet` line classified `gst` by `classifyTaxLine` in `src/lib/xero/tax-lines.ts`). Class is a Xero-set field, not a name match.
- `hasPayroll` — low/medium confidence, see item 3. True when a `balance_sheet` line classifies as `super` or `payg`, OR `accounts` contains an EXPENSE account whose name matches wages/salaries/payroll. Reported as `yes | no | unknown`, never a bare boolean.
- `usesInvoicing` — medium confidence, transient risk. `invoices_accrec_open` payload has at least one invoice, OR `accounts` contains a system `DEBTORS`/Accounts Receivable account with a non-zero balance-sheet debtors line.
- `usesBills` — same shape against `invoices_accpay_open` plus a creditors line.
- `hasFixedAssetRegister` — medium. `accounts` contains at least one account with `Class === "ASSET"` and `Type === "FIXED"`, and the balance sheet shows a non-zero fixed-asset section. Presence of FIXED accounts proves the chart supports it; it does not prove a depreciation register is maintained, so the flag means "fixed assets exist", not "register is complete".
- `hasBankFeeds` — rename to `bankAccountCount`. `accounts` count where `Type === "BANK"`. Feeds themselves are not visible in these snapshots; do not claim feed status.

Every flag also carries `evidence` (which snapshot key and which matched account/line names) so a wrong flag is diagnosable without a Xero call.

### 2. Structural vs transient — the rule that decides gating

Only structural absence hides a card. Transient absence shows the card with an honest empty state.

| Widget | Absence type | Evidence that separates them | Action |
|---|---|---|---|
| GST reconciliation | structural | `Class = NON_GST_CASHBOOK` / `PaysTax = false` — the file can never produce GST | hide permanently |
| Superannuation (merged, see Part B) | ambiguous | no super line could mean no payroll or unusual naming | show, empty state |
| Receivables | transient | zero open invoices this week says nothing about the file | always show |
| Payables | transient | same | always show |
| Fixed assets reconciliation | structural-ish | no FIXED-type accounts at all in `accounts` | hide, but only on zero FIXED accounts; any FIXED account means show |
| Break-even (merged) | transient | no cost classifications is a setup gap, not a file property | show with a setup prompt |
| Cash Flow | transient | zeros are a real answer | always show |

Where the profile cannot tell structural from transient — payroll, invoicing on a file that simply has nothing open right now — default to showing the card. A card that appears and disappears with the trading week is worse than a blank card.

### 3. Payroll inference and its false-negative risk

Balance-sheet super/PAYG lines plus wage expense accounts are good enough to say "probably yes"; they are not good enough to say "definitely no". Name matching in `classifyTaxLine` keys off `super`, `payg`, `paye`, `withholding`. A file with accounts named "Employee Entitlements", "Statutory Deductions", "Contributions Payable" or a numeric-code-only chart yields a false negative. This has already bitten us on PAYG.

Consequence for the design: `hasPayroll` is tri-state and only the explicit `no` from a `NON_GST_CASHBOOK` file with zero wage accounts and zero super/PAYG lines is treated as structural. Everything else shows the card. Payroll is never used to hide a card on the strength of name matching alone.

### 4. Override

Smallest mechanism that needs no new database object: reuse the existing per-client widget switch, `public.set_client_widget_enabled(_client_id, _widget, _enabled)`, already used by the tier settings UI. Staff force a widget on or off there; the capability profile only ever suppresses a widget that is otherwise enabled, and an explicit staff decision wins over the profile in both directions.

That requires storing "explicitly on" vs "default", which the existing `tier_widget_config.widgets` / `excluded_widgets` arrays already express. No new table, column, policy or function. If, on build, the existing arrays turn out not to distinguish "on by default" from "forced on", I will stop and bring you a single-column proposal for approval rather than adding it silently.

### 5. Where it is computed

Derived at read time, not stored. New file `src/lib/xero/file-capability.server.ts` exporting `resolveFileCapability({ supabase, tenantId, clientId })`, built on `readSnapshot` from `src/lib/xero/snapshot-read.server.ts` so RLS applies as the caller and a tenantId stays a filter, not a grant. It reads four snapshot rows already fetched daily, so the marginal cost is four indexed selects. Memoised per request via `src/lib/xero/request-memo.server.ts`.

No stored capability state: it would go stale the moment a chart of accounts changes, and would need its own invalidation path and a database object. Read-time derivation is both cheaper and self-healing.

## Part B — the merges

### 6. Tax liabilities + Superannuation → one card

Promote `getProtectedMoney` (`src/lib/xero/reports.functions.ts:425`) to the single implementation. It already returns GST, PAYG and super from one balance sheet read, with the resolved/unresolved distinction that keeps "no matching account" separate from "zero".

- New card: "Money you are holding for someone else", widget key `tax_liability` retained.
- `superannuation` becomes a section inside it. The key is not deleted: it stays in the catalogue as a deprecated alias so any tier row referencing it keeps validating, and the resolver maps it to `tax_liability`. Nobody loses a card and no tier or plan row is edited.
- `src/components/dashboard/SuperannuationWidget.tsx` and `TaxLiabilityWidget.tsx` are replaced by one component; the superannuation server path is retired in favour of `getProtectedMoney`.
- Files: `src/lib/tiers.ts` (label + alias only), the two dashboard components, `src/routes/_authenticated/clients.$clientId.index.tsx`.

### 7. Accounting Break-Even + True Break-Even → one card

They render identical numbers for all 12 clients today, because True Break-Even's cash commitments are empty for all of them. Merge into one card keyed `accounting_breakeven` (label "Break-Even"), with cash commitments as an expandable section fed by `true_breakeven`'s existing inputs. `true_breakeven` becomes a deprecated alias in the same way as `superannuation`.

With no cost classifications — currently every client — the merged card shows the honest state: the revenue and gross-margin figures it does have, the sentence explaining that fixed/variable split is not set up yet, and a direct link to the cost classification screen. It does not show a fabricated break-even point and it does not show "not enough data" with no route forward.

Files: `src/components/dashboard/AccountingBreakevenWidget.tsx`, `TrueBreakevenWidget.tsx`, `TrueBreakevenSection.tsx`, `useBreakevenData.ts`, `src/lib/tiers.ts`.

### 8. Business Health on snapshots

Confirmed as the fix. `getBusinessHealthDetail` today calls Xero directly at `src/lib/health.functions.ts:553` (P&L), `:558` (balance sheet), `:559` (AR invoices), plus optional prior-period calls at `:563`, `:568`, `:569`. The AR call at `:559` is the disagreement: Receivables reads `invoices_accrec_open` from the snapshot while Health re-fetches live, so the two cards can show different totals on one screen.

Converting Health to `readSnapshot` for `profit_and_loss_*`, `balance_sheet`, `balance_sheet_prior`, `invoices_accrec_open` and `invoices_accpay_open` makes both cards read the identical stored payload, so they cannot disagree. Health keeps its live branch only when the user's chosen date range does not hash-match the catalogue params, exactly as Receivables does. Health's computation is unchanged.

### 9. Dead code

Confirmed. `rg "getBusinessHealth\b" src` returns two hits, both inside `src/lib/health.functions.ts`: the declaration at line 274 and a comment at line 398 noting its summary was merged into `getBusinessHealthDetail`. No route, component or other module imports it. Safe to delete along with any helper that becomes unreachable with it.

## Net effect on card count

Advisory clients go from a set including two break-evens and two tax/super cards to one of each, plus structural hiding of GST reconciliation on cashbook files. No widget's computation changes.

## Invariants (section 0)

Touched: 4 and 8. The capability profile reads snapshots through `context.supabase`, so a tenantId remains a filter and never a grant; hiding a card never widens who can see data. Fail-closed holds: an unreadable or missing snapshot yields an `unknown` profile, and `unknown` shows the card rather than hiding it, so a profile failure can never suppress data a user is entitled to.
