# Make the year-to-date comparison unambiguous

## Classification

**Security-relevant** because the monthly report presents client Xero financial data. This is presentation-only: no access path, policy, role, stored figure, Xero request, calculation, or report period will change.

**Invariants protected:** client figures remain caller-authorised and audited through the existing report path; no financial data or token leaves that path; the report continues comparing like-for-like periods.

**Threat:** misleading headings can make a one-month comparison look like a forecast or a completed-year comparison, causing a client to draw the wrong conclusion from correct figures.

## What is happening now

For the July 2026 report, the calculation compares:

- **1–31 July 2026**
- **1–31 July 2025**

The figures and variance are correct. The headings “FY27 YTD” and “FY26 YTD” do not reveal those matching windows, so they can be mistaken for whole financial years.

## Changes

1. Replace the abbreviated year-to-date headings with exact periods:
   - **Current period — 1–31 Jul 2026**
   - **Same period last year — 1–31 Jul 2025**
2. Use the equivalent exact ranges for later reports, such as **1 Jul–30 Sep 2026** versus **1 Jul–30 Sep 2025**.
3. Apply the wording consistently to:
   - the desktop key-figures table;
   - the mobile key-figure blocks;
   - the generated PDF summary.
4. Keep the existing monthly, prior-month, year-to-date, variance, colour and judgement calculations unchanged.
5. Add focused tests proving the exact comparison windows and labels for:
   - July, where year to date is one month;
   - a later month, where year to date spans several months.
6. Record the wording correction in the security backlog and run the full security gate, including report tests, catalogue/table/signature checks and live access checks.

## Expected result

A client will see immediately that July 2026 is being compared with July 2025. Nothing will imply that the app already knows the final FY27 result, and no financial calculation will change.
