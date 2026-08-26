# Read-only diagnosis: Bangkok on King statutory account matching

No code, data, schema, policy, entitlement, or Xero state was changed. No Xero call was made.

## Conclusion

This is **not a failure of `classifyTaxLine` to recognise Bangkok on King’s account names**, and the accounts were **not absent** from the 31 July 2026 Balance Sheet.

The failure is one layer earlier: `src/lib/health/rules.server.ts:114` and `:184` pass the whole Xero API envelope (`{ Reports: [...] }`) to `extractTaxLines`, while `src/lib/xero/tax-lines.ts:51-71` expects the inner report object whose `Rows` property is at the top level. The live report path creates that envelope in `src/lib/reports/report-verdict.server.ts:205-206` and passes it unchanged into the rules engine at `:223-230`.

Consequently, `extractTaxLines(balanceSheet.payload)` sees no `payload.Rows` and returns `[]`. The same contract mismatch also makes `extractCashAtBank(balanceSheet.payload)` return zero. The July draft’s “no account could be matched” statement is therefore false.

The stored 31 July Balance Sheet contains all of these, verbatim:

- `ATO Superannuation Guarantee` → `super`
- `GST` → `gst`
- `Income Tax Payable` → `other_tax` (the code’s type is `other-tax`)
- `PAYG Withholdings Payable` → `payg`
- `Superannuation Payable` → `super`

It also contains `GST and others Pty Ltd` → `gst`, although that is a bank account and demonstrates why name-only matching is unsafe.

## 1–2. Balance Sheet lines and `classifyTaxLine` results

Stored snapshot dates:

- `balance_sheet`: requested for 26 August 2026; fetched 26 August 2026 08:06 UTC.
- `balance_sheet_prior`: requested for 31 July 2026; fetched 26 August 2026 08:06 UTC.
- July report draft: period end 31 July 2026; generated 26 August 2026 08:08 UTC. Its payload does not retain the raw Balance Sheet, but the live request used the same date as `balance_sheet_prior`. The two stored Balance Sheets differ only by `Loan - Ausvance/Capify`, which appears in July and not in the current snapshot.

The complete July leaf-line list, in Xero order:

| Balance Sheet line (verbatim) | Classification |
|---|---|
| Bangkok on Darby  Saving - no access to bank | unmatched |
| Bangkok on Darby Pty Ltd 8671  | unmatched |
| GST and others Pty Ltd | gst |
| Rent Business Account Pty Ltd  | unmatched |
| Accounts Receivable | unmatched |
| Cash on Hand | unmatched |
| Prepayments - Colliers (Rent) | unmatched |
| Security Bond | unmatched |
| Furniture & Fittings | unmatched |
| Less Accumulated Depreciation on Furniture & Fittings | unmatched |
| Motor Vehicles | unmatched |
| Less Accumulated Depreciation on Motor Vehicles | unmatched |
| Office & Computer Equipment | unmatched |
| Less Accumulated Depreciation on Office & Computer Equipment | unmatched |
| Less Accumulated Depreciation on Plant & Equipment | unmatched |
| Plant and Equipment at Cost | unmatched |
| Borrowing Costs | unmatched |
| Accounts Payable | unmatched |
| American Express Platinum Busi | unmatched |
| ATO Superannuation Guarantee | super |
| GST | gst |
| Income Tax Payable | other_tax |
| Loan - Fee Synergy | unmatched |
| Loan - New Ongoing Square Loan | unmatched |
| Loan - Payright | unmatched |
| Loan Afterpay and Pay in 4 | unmatched |
| PAYG Withholdings Payable | payg |
| Superannuation Payable | super |
| Suspense | unmatched |
| Wages Payable - Payroll | unmatched |
| Director's Loan - 2024 | unmatched |
| Director's Loan - FY2024-25 | unmatched |
| Director's Loan - FY2025-26 | unmatched |
| Loan - Ausvance/Capify | unmatched |
| Loan - Lotus Commercial | unmatched |
| Loan - Lumi Finance | unmatched |
| Loan - Square 3 | unmatched |
| Net Assets | unmatched |
| Current Year Earnings | unmatched |
| Issued Share Capital | unmatched |
| Retained Earnings | unmatched |

The current stored Balance Sheet has the same lines and classifications except that `Loan - Ausvance/Capify` is absent. Section titles and Xero-generated total rows were also traversed during diagnosis; none adds a statutory classification.

## 3. Which cause

**Neither of the two proposed causes precisely describes the defect.** The statutory accounts are on the July Balance Sheet and their names are recognised when `classifyTaxLine` is called directly. The rules engine never reaches those names because it gives the extractor the wrong object level.

This is a **report payload-contract failure**. It manifests as a matcher failure, but the name matcher itself accepts the relevant Bangkok on King lines.

## 4. `accounts` snapshot cross-check

Every account whose name, type, or system field suggests GST, PAYG, superannuation, or tax:

| Name (verbatim) | Type | Class | SystemAccount | Status |
|---|---|---|---|---|
| ATO Superannuation Guarantee | CURRLIAB | LIABILITY | — | ACTIVE |
| GST | CURRLIAB | LIABILITY | GST | ACTIVE |
| GST and others Pty Ltd | BANK | ASSET | — | ACTIVE |
| Income Tax Expense | EXPENSE | EXPENSE | — | ACTIVE |
| Income Tax Payable | CURRLIAB | LIABILITY | — | ACTIVE |
| Loan - The Early Bird & Sweet Basil Pty Ltd | TERMLIAB | LIABILITY | — | ACTIVE |
| Old GST Account | BANK | ASSET | — | ACTIVE |
| PAYG Installments | CURRLIAB | LIABILITY | — | ARCHIVED |
| PAYG Withholdings Payable | CURRLIAB | LIABILITY | — | ACTIVE |
| Purchases - GST | DIRECTCOSTS | EXPENSE | — | ACTIVE |
| Purchases - GST Free | DIRECTCOSTS | EXPENSE | — | ACTIVE |
| Square Discounts (Tax Free) | REVENUE | REVENUE | — | ARCHIVED |
| Square Discounts (Taxable) | REVENUE | REVENUE | — | ARCHIVED |
| Square Sales (Tax Free) | REVENUE | REVENUE | — | ARCHIVED |
| Square Sales (Taxable) | REVENUE | REVENUE | — | ARCHIVED |
| Square Surcharges (Tax Free) | REVENUE | REVENUE | — | ARCHIVED |
| Square Surcharges (Taxable) | REVENUE | REVENUE | — | ARCHIVED |
| Superannuation | EXPENSE | EXPENSE | — | ACTIVE |
| Superannuation Payable | CURRLIAB | LIABILITY | — | ACTIVE |

`GST` has Xero’s authoritative `SystemAccount = 'GST'` flag. `classifyTaxLine` does **not** use it: its signature is only `classifyTaxLine(name: string)` (`src/lib/xero/tax-lines.ts:32`) and it uses substring tests on the name. That is a separate defect. The Balance Sheet rows carry an account ID, so the report line can be cross-referenced to the `accounts` response.

The current substring logic also creates false positives: `Loan - The Early Bird & Sweet Basil Pty Ltd` contains the letters `bas` inside “Basil”, so the name-only matcher would call it `other_tax` if that line appeared on the Balance Sheet.

## 5. Blast radius

The database currently has snapshot sets for **15 tenants, not 14**. This is one more than the stated cohort. Results are therefore reported both ways:

- **All 15 snapshot-backed tenants are exposed to the envelope defect** in the verdict rules because every Balance Sheet snapshot stores the Xero envelope.
- **11 of 15** currently have one or more directly matchable statutory names on their Balance Sheet, yet the runtime extractor returns no tax lines. These are demonstrable false “no account could be matched” outcomes.
- **4 of 15** have relevant active accounts in `accounts` but no matchable statutory line on the current Balance Sheet: X1, X3, X4 and X5 Enterprises Pty Ltd. For these, absence/nil balance is plausible from stored data, though the current wording still overstates what is known.
- If Positive Traction’s own tenant is excluded to reproduce the requested **14-client cohort**, the count is **10 of 14 false outcomes**, with the same four true Balance Sheet absences.
- Directly applying `classifyTaxLine` to the Balance Sheet names produces **zero name-recognition failures** among the 11 files that contain matchable lines. The failure is extraction, not classification.

Files with matchable Balance Sheet lines but runtime extraction failure: A.C.N. 657 659 026 Pty. Ltd.; Autotek New South Wales Pty Ltd; Bangkok on King; DRTABT Projects Pty Ltd; Positive Traction; TracyFinlay; X10; X11; X12 & X13; X14; and X8 Enterprises Pty Ltd.

## 6. Wording that distinguishes the facts

**Account absent from the Balance Sheet:**

> “No GST, PAYG withholding or superannuation balances appeared on the Balance Sheet for this period, so protected money could not be assessed from that report.”

This says the balances did not appear; it does not claim the file has no such accounts.

**Lines present but not recognised reliably:**

> “The Balance Sheet included statutory balance lines that this report could not identify reliably, so protected money could not be assessed.”

**The system cannot distinguish absence from a parsing or matching failure:**

> “The available accounting records were not sufficient to determine the GST, PAYG withholding and superannuation balances for this period, so protected money was not assessed.”

The report should use the neutral third sentence whenever it cannot prove the cause. It must never convert an internal extraction failure into a claim that the client’s accounts were absent.

For Bangkok on King, after correcting the payload contract, none of these gap sentences should appear: the July Balance Sheet contains recognised GST, PAYG withholding and superannuation lines, so R01 and R05 should evaluate normally.

## Recommended fix (not implemented)

1. Define one Balance Sheet input contract and normalise the API envelope at the boundary: pass `response.Reports?.[0]` to `extractTaxLines` and `extractCashAtBank`, rather than making downstream rules guess the shape.
2. Add regression tests using a real `{ Reports: [{ Rows: ... }] }` response envelope and the inner report object, covering both the live report path and snapshot path.
3. Cross-reference each Balance Sheet row’s account ID against the Accounts response; treat `SystemAccount = 'GST'` as authoritative and use constrained account type/class/status evidence for PAYG and superannuation.
4. Replace the unbounded `includes('bas')` test with a token/word-boundary rule to prevent “Basil” being classified as BAS.
5. Return structured extraction outcomes (`assessed`, `absent`, `unrecognised`, `input_invalid`) so document wording is based on the known cause rather than an empty array.
6. Regenerate Bangkok on King’s existing July draft after the fix. Its payload version 11 has frozen the incorrect verdict wording and figures; merely fixing runtime code will not rewrite that stored draft.

## Relevant file paths

- `src/lib/xero/tax-lines.ts` — name classifier and extractors; expects an inner report object.
- `src/lib/health/rules.server.ts` — passes the full stored/live payload envelope to those extractors.
- `src/lib/reports/report-verdict.server.ts` — fetches the live Balance Sheet and wraps the full response for rules evaluation.
- `src/lib/xero/snapshot-refresh.server.ts` — stores the full Xero response payload.
- `src/lib/xero/snapshot-keys.ts` — defines current and prior Balance Sheet snapshot dates.
- `src/lib/xero/file-capability.server.ts` — correctly descends through `bsPayload.Reports[0].Rows`, confirming the intended envelope shape elsewhere.
- `src/lib/reports/coverage-gaps.ts` — currently turns the empty extraction result into the client-facing “could be matched” sentence.
