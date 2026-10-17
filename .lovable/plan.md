# Wages split, tax wording/status, instalment settings, Client settings tidy-up

Classification: SECURITY-RELEVANT (one new client setting for instalments; reads of client P&L data). No change to who can read or write any existing row. All other parts are presentation.

## 1. Wages as their own line
- Source: existing `is_wages` marker in Cost classification only. Wages accounts are pulled out of whichever P&L section they sit in (cost of sales or operating), summed once.
- One pure helper `splitWages(pnl, wageAccountIds)` returns Cost of sales (excl. wages), Wages, Overheads (excl. wages); Gross profit and Net profit are passed through unchanged (asserted).
- Live P&L card: tiles Income · Cost of sales (excl. wages) · Wages · Gross profit · Overheads (excl. wages) · Net profit, each with the current comparison line. Note "Wages = accounts marked Wages in Cost classification (n accounts)" linking to the tab.
- 12-month chart: expense bar stacked Wages / Other costs, net-profit line unchanged. Months with no per-account history show the unsplit bar (honest gap).
- Monthly report: same split on P&L page and chart, frozen into NEW drafts only; payload version bumped; final/sent untouched.
- Break-even and Cash flow scenario: Wages shown as its own group; each wage account keeps its fixed/variable tag in the maths, so results are identical.
- No marker set: no split; practice users see "Mark wage accounts in Cost classification to see wages separately."
- Trixie P&L / compare-periods tools return the same split.

## 2. "Building" → "Currently accruing" everywhere (tax only)
Tax obligations tile, Health "Next tax payment" line, Overview tax column, monthly report/PDF, Trixie prompts/tools, demo fixture, tests. Unrelated uses (construction industry, "building" verbs) left alone. Full list reported at the end.

## 3. Lodged bill status follows the due date
- One pure `billStatus(due, today, owing)` using the organisation's timezone (Perth for PT): before → "Not due yet · in n days"; on → "Due today"; after with amount owing → "Overdue · n days overdue"; nothing owing → "Paid".
- Tile heading changes from "Due now" to "Lodged" so the heading no longer contradicts the status.
- Colours: neutral / brand royal-blue soft warning / existing destructive red.
- Used by the card, Overview reasons, Health line, monthly report and Trixie. Amounts unchanged. Tests for before/on/after 21 Oct.

## 4. Income tax instalments move to Client settings
- New column `clients.income_tax_instalment_frequency` (null | not_required | quarterly | annual), written only through a new audited AAL2 caller-scoped function that reuses `can_manage_client_income_tax_instalments` (organisation team only, same rule as today). Read through the existing caller-scoped client read.
- Migration default: clients with saved instalments → "quarterly" (annual if history is yearly); others stay unset. Nobody silently "Not required". Existing rows kept.
- Tax & reporting gets "Income tax instalments (PAYG instalments)": the choice plus the existing entry/history editor moved from the dashboard.
- Dashboard tile: no edit control for any role. Not required → "Not required"; required but missing → "Not entered yet" (+ "Set in Client settings" link for practice users); else amount, due date and the same status rule.
- forwardTax, monthly report, Overview and Trixie: Not required contributes nothing and says so.
- Security: matrix rows, definer register, fixture, backlog updated; tests that Business Owner/Viewer cannot save.

## 5. Client settings tidy-up
General keeps setup only: Client name, Setup checklist, Package, Xero organisations.
Moves:
- Report branding → Cards & report branding
- Profit & Loss basis, Lodgement cycles, GST accounting method, GST/PAYG/super coding, Income tax instalments → Tax & reporting
- Bank accounts & credit cards → Banks & accounts
- People access, Danger zone already on their tabs (confirm)
Setup checklist links point to new tabs; old `general#anchor` links redirect to the matching tab. Same controls, saves and permissions.

## Checks
tsgo, build, vitest tests/, bun test src, security:check, linter/posture. Tests: totals unchanged for Demo Company and Positive Traction fixtures; wages across COGS+operating counted once; no split when unmarked; final reports unchanged; status dates; instalment rules.
