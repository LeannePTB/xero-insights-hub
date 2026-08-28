# R01: protected money split across the balance sheet and ATO payables

Plan only. Nothing below is implemented yet. No thresholds change in this build.

## 0. The one thing that had to be checked first

`invoices_accpay_open` **does include line-level account coding.** Every one of the 79 open bills stored across the 15 tenants carries a `LineItems` array, and every line carries `AccountID`, `AccountCode`, `Description`, `LineAmount` and `TaxType`. Example (Bangkok on King, one bill):

```text
AccountCode 820  GST                        12,262.00  BASEXCLUDED  "Activity Statement for Jul-Sep 2024 - GST"
AccountCode 825  PAYG Withholdings Payable   6,822.00  BASEXCLUDED  "... - PAYG tax withheld"
AccountCode 830  Income Tax Payable            360.00  BASEXCLUDED  "... - PAYG income tax instalment"
```

So the design can rest on line accounts. No new Xero call is needed, and `AccountID` joins straight onto the `accounts` snapshot that `analyseBalanceSheet` already consumes.

Both `invoices_accpay_open` and `invoices_accrec_open` are stored `complete = true` for all 15 tenants today, so truncation is currently theoretical — but must still be handled (section 4).

## 1. Identifying an ATO payable

Ranked by dependability:

1. **Line `AccountID` matches a statutory account already recognised by `analyseBalanceSheet`** — dependable, and the only signal used to *include an amount in a figure*. It is the same account identity R01 reads on the balance sheet, so the two sides can never disagree about what the money is.
2. **Line `AccountID` matches a liability account whose name reads as an ATO clearing/suspense account** (Autotek's `850-1 Suspense - ATO`) — dependable enough to *classify the file's pattern*, not to add an amount blindly. Section 3.
3. **`TaxType = BASEXCLUDED`** — necessary but not sufficient. Every statutory line observed uses it, but so do interest, wages and drawings lines. Use only as a corroborating check, never alone.
4. **Contact name** (`Australian Tax Office`, `Australian Taxation Office`, `Australian Tax Office - Tax Returns` all appear in the real data) — used only as a *cross-check for refusal*: an ATO-named bill whose lines hit no statutory account is the trigger for "present but not traceable", not for a figure.
5. **Reference / description text** ("Activity Statement for Jul-Sep 2024") — human-readable evidence to show staff, never a matching key.

Rule: **amounts come from line accounts; names only ever cause us to refuse, never to assert.**

## 2. The three-part figure

For a period end `D`:

- **Accruing toward the next lodgement** = the existing balance sheet figure, unchanged: `buildProtectedMoney(...)` over GST, PAYG withholding and superannuation lines from `analyseBalanceSheet`.
- **Lodged and still owing** = for each open ACCPAY bill, the sum of `LineAmount` on lines whose `AccountID` is one of those same statutory accounts, **scaled by the proportion of the bill still unpaid** (`AmountDue / Total`), with bills dated after `D` excluded. Scaling is required because payments hit the bill, not the line, so a part-paid bill must not be counted in full.
- **Total held or owed** = the sum of the two.

**No double counting.** The bill's own line *is* the debit that removes the amount from the statutory account — that is the mechanism the workflow relies on. The balance sheet at `D` is therefore already net of every bill raised on or before `D`; adding the unpaid remainder of those bills adds each dollar exactly once. Verified on Positive Traction at 31 July: statutory accounts $7,480 (August accrual, bill not yet raised), July BAS bill $5,835 total with $1,000 due → accruing $7,480, lodged and owing $1,000, total $8,480. Under today's code R01 reports $7,480.

## 3. Detecting the workflow per file

Evidence is taken only from stored snapshots (`invoices_accpay_open`, `accounts`, `balance_sheet`).

**Bill pattern** — at least one open ACCPAY bill has a line coded to a recognised statutory account. High confidence; it is direct evidence of the mechanism. Observed in Bangkok on King (codes 820/825/830) and Positive Traction (21300/21420). Treatment: three-part figure as above.

**Direct pattern** — no open ACCPAY bill has a statutory line, and no ATO-named bill is open at all. Moderate confidence: absence of bills is consistent with direct coding but also with "nothing lodged yet". Treatment: balance sheet figure only, reported as today, with no claim that a lodged amount is outstanding. This is the current behaviour for the twelve tenants with no ATO bills.

**Clearing pattern** — open ATO bills are coded to a liability account that is *not* one of the statutory accounts, and that account carries a large contra (negative) balance on the balance sheet. High confidence when both halves are present; the contra is what proves the account is being used as an ATO clearing account rather than an ordinary liability. Observed in Autotek (section 6). Treatment: **refuse the split** — see section 4 — until a decision is made about netting the clearing account, which this build will not make.

## 4. Refusal wording

No figure is asserted unless the pattern is established. Proposed lines, in the report's existing register:

- **Pattern unclear** — "The way lodged activity statements are recorded in this file could not be established from the records available, so the amount already lodged and still owing to the ATO has not been included in this figure."
- **ATO bills present but not traceable to statutory accounts** — "There are unpaid bills to the ATO in this file, but they are not coded to the GST, PAYG withholding or superannuation accounts, so they could not be reconciled against the balances on the Balance Sheet. Only the Balance Sheet position is reported here."
- **Payables snapshot missing or truncated** — "The list of unpaid supplier bills could not be read in full for this period, so any activity statement already lodged and still owing has not been included in this figure."

Each refusal suppresses the "lodged and owing" and "total" lines entirely rather than showing them as zero, and feeds the existing coverage-gap sentence machinery in `src/lib/reports/coverage-gaps.ts` so it de-duplicates alongside the other gaps.

## 5. Severity

My view matches yours: **the total should drive severity**, but only where the split was established.

For it: a lodged BAS is a crystallised debt with a due date. Money still accruing is an estimate that will not be demanded for weeks. Treating the lodged, overdue portion as less urgent than the accrual inverts the real risk. Under the bill pattern, using the balance sheet alone also makes the figure *fall* the moment a BAS is lodged — the worst possible moment for it to look better.

Against it: the existing thresholds were calibrated against balance-sheet-only figures, so switching the numerator to the total will move some files across a boundary for reasons that are not a change in the business. There is also an asymmetry — files on the direct pattern will always have a smaller numerator than files on the bill pattern, so the same underlying position could grade differently by bookkeeping style alone.

Resolution: drive severity from the total, but only where the pattern is **bill**; where it is direct, the total already equals the balance sheet figure, so nothing changes; where it is clearing or unclear, keep the current behaviour and say so. Thresholds stay exactly as they are in this build, and a before/after grade table across all 15 tenants should be produced before anything is enabled.

## 6. Autotek

Autotek is **not double counting, and not on the bill pattern** — it is the clearing pattern, and the corrected figure is materially different from either number in the question.

Its five open ATO bills are all coded to a single line: **`850-1 Suspense - ATO`**, a LIABILITY account, `BASEXCLUDED`, with descriptions like "Activity Statement for Apr 2026 - PAYG tax withheld" and one payment-plan bill covering four periods. A sixth bill, from contact "Australian Tax Office - Tax Returns", is coded to `830 Income Tax Payable` (a statutory account, but income tax, not BAS).

Balance sheet at the latest snapshot:

```text
GST                          13,525.83
PAYG Withholdings Payable    18,059.00
Superannuation Payable        1,039.89
Income Tax Payable            4,569.87
Suspense - ATO              -57,716.83   <- contra, created by the bills
```

Open ATO bills, amount due: 30,773.69 + 13,262.00 + 5,910.00 + 4,835.00 + 736.14 = **55,516.83** against Suspense, plus **5,638.62** against Income Tax Payable.

So the $30,773 payment plan and the GST/PAYG balances are **not** mutually exclusive and **not** duplicated either — the duplication is cancelled by the −$57,716.83 contra, which today's R01 ignores entirely. Netting all of it:

```text
statutory accounts (GST + PAYGW + Super)      32,624.72
Suspense - ATO contra                        -57,716.83
unpaid ATO bills against Suspense            +55,516.83
                                             ----------
corrected BAS-related position                30,424.72
(plus Income Tax Payable 4,569.87 less its own bill's unpaid 5,638.62,
 which is income tax, outside R01's scope)
```

Today R01 reports **$32,624.72**. The corrected BAS figure is **$30,424.72** — close by coincidence, because the contra and the outstanding bills nearly offset. They would not offset in a file with more paid-down bills, which is exactly why the clearing pattern must be refused rather than approximated until the contra handling is explicitly designed.

## 7. The file audit finding

Yes — an untraceable statutory position is a bookkeeping defect, not just a gap in our reporting.

- **Rule** `A-STAT-TRACE`, category: statutory accounts.
- **Severity: warning.** Not critical — no figure is wrong on the face of the file, and the money may well be correctly recorded. But it makes the ATO position unverifiable from the ledger, which is the whole point of coding it there.
- **Fires when** open ATO-named bills exist and none of their lines reach a recognised statutory account, or a liability account carrying a material contra balance is receiving ATO bills.
- **Wording** — "Unpaid bills to the ATO in this file are coded to *{account name}* rather than to the GST and PAYG withholding accounts. The amount owed on lodged activity statements cannot be reconciled against the Balance Sheet from the records as recorded."
- **Not raised** where no ATO bills exist at all; absence is not evidence of a defect.

## Files this would touch when built

- `src/lib/xero/tax-lines.ts` — a new extractor over `invoices_accpay_open`, joining line `AccountID` to the statutory accounts already resolved there; returns the same structured `ExtractionStatus` shape.
- `src/lib/health/rules.server.ts` — R01 gains the three-part figure, the pattern classification and the three refusal paths.
- `src/lib/reports/report-verdict.server.ts` — passes the already-fetched open payables through to the rules engine on the live report path.
- `src/lib/reports/coverage-gaps.ts` — the new refusal sentences join the de-duplication set.
- `src/lib/health/rules.test.ts` — regression cases for each pattern, part-paid bills, bills dated after period end, and each refusal.
- Audit rules module — the `A-STAT-TRACE` finding.

No database object is created or altered.
