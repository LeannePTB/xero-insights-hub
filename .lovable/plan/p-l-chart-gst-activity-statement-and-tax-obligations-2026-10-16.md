# P&L chart, GST activity statement and Tax obligations

Classification: SECURITY-RELEVANT (migration on a client-data table, new audited client setting write, Xero API calls, cross-card tax figures). Invariants touched: 1, 2, 4, 6, 7, 11. No access is widened.

## Part 1 — P&L card
- Chart range becomes the current Australian financial year (1 July to today, Sydney time); current month marked partial. Title built from the date: "Income, expenses and net profit · FY26–27 to date". Same range in new monthly reports only (final/sent untouched). The three comparison tiles stay.
- Migration (owner-approved): add nullable `income` and `expenses` numeric columns to `client_figure_history`, no grant or policy changes (existing policies already cover the table). Comment them.
- Backfill: one Xero `Reports/ProfitAndLoss` call per Xero file with `periods`/`timeframe=MONTH` for July to last month, through the existing request gate and limiter. Positive Traction first; others queued with spacing inside the gate's per-file budget. Months Xero does not return stay null and show as "unavailable". Net profit from the backfill is compared against stored `net_profit`; mismatches are reported, not overwritten.
- Nightly job writes income/expenses alongside net profit for the month it already captures.
- Layout: Period selector moves into the card header row (right side, beside badge and refresh; stacks under the title on mobile); chart title and legend share one line when wide; vertical gaps reduced.

## Part 2 — GST activity statement card
- Method: read `Organisation.SalesTaxBasis` (stored organisation snapshot first). Card label: "Cash basis (from Xero)" / "Accrual basis (from Xero)" / "Cash basis (set by your adviser)". Blank or unreadable: card prompts the practice to choose in Client settings.
- Override: new "GST accounting method" field in Client settings → Tax Reporting, stored as a `gst` key in the existing per-client `basis_overrides` (no new table). Saved through a new audited AAL2 definer function guarded by the existing manage-client write predicate (Owner/Staff/practice team; System Administrator only via normal access). Business Owners and Viewers cannot change it. Register, matrix rows and tests added.
- Cash-basis calculation: GST from payments received/made in the period (bank transactions, payments on invoices/bills, with their tax lines), not invoice dates.
- Unfiled earlier-period amounts: shown as a separate line.
- PAYG / pay-run inputs, notes and completeness checks removed from this card; completeness depends only on GST inputs. PAYG card unchanged.

### Honest limit on matching Xero exactly
The Xero Accounting API has no activity-statement endpoint and does not expose which transactions were included in a lodged return. So "unfiled amounts" cannot be read directly. Plan:
1. Compute period GST (cash basis) from transactions dated in the period.
2. Estimate unfiled earlier amounts as: GST account movement since the end of the last lodged period (from the stored period-end balance sheet and the lodged ATO bill) minus the period's own GST, labelled "Estimate — Xero does not report which earlier amounts are unfiled".
3. Show workings for Positive Traction against Xero's 1A 4,184 / 1B 178. If they do not match within rounding, the card keeps the "estimate" label and the report says exactly which piece is missing. No figures are invented.

## Part 3 — Tax obligations card
Rows, using `lodgedAtoBills` and the Part 2 GST result (same helpers feed Business Health, Overview and new reports):
- Lodged and still owing: $X · period · due date (Overdue in red).
- Building now (period so far): GST · PAYG withholding · total · due date (quarterly clients show the quarter).
- Income tax instalment: amount · due, or "Not entered — add instalment" (button kept).
- Total to plan for.
- Secondary small text: last lodged period figures.
- Note when the GST account balance differs from the period's GST, with the difference.
Report will explain PT's ~$4,983 vs $4,006 (expected: unfiled/timing amounts and any manual journals to the GST account).

## Verification
Unit tests: FY range/label, monthly backfill parsing and gaps, cash-basis GST, method resolution precedence (override > Xero > prompt), override permissions by role, tax-row composition and overdue state. Then all tests, security check, register regeneration, and PT readings. Explicit tsgo/full-build commands are blocked here; automatic compilation will be reported instead.

## Technical details
- Files: `src/lib/charts/standard.server.ts`, `StandardHistoryChart.tsx`, `PnlWidget.tsx`, `DashboardCardHeader.tsx`, `figure-backfill.server.ts`, nightly snapshot route, `gst.server.ts`, `gst.functions.ts`, `GstReconciliationWidget.tsx`, `TaxObligationsWidget.tsx`, `tax-obligations.ts`, `health-checks.ts`, Tax Reporting settings section, `docs/security/*`, `docs/security-backlog.md`.
- Two migrations: columns on `client_figure_history`; `set_client_gst_method` definer (search_path set, `assert_aal2`, caller guard, EXECUTE revoked from PUBLIC/anon, audit insert).
