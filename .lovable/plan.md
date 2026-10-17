# Cash flow scenario page — fixes, adjustments, saved scenarios

Classification: SECURITY-RELEVANT (new table holding client data, new read path for client-side users, audited writes, report content).

## Decision needed before building C (saved scenarios)

**Conflict with security rule 2.D (external adviser / Viewer):** "Read-only everywhere: never scenario exclusions…". A saved scenario stores invoice exclusions, so "Share with client" would show Viewers scenario exclusions.

Proposed resolution (pick one):
1. **Share with Business Owners only** (path E already covers scenario exclusions). Viewers never see saved scenarios. No rule change. *Recommended.*
2. Share with Viewers too, but only the adjustments and the Baseline vs Scenario totals, never the invoice list or exclusions. Needs you to amend rule 2.D.
3. Amend rule 2.D to let Viewers see shared scenarios in full.

Until you choose, the plan assumes option 1.

## A. Invoice list fixes
- Choosing a customer in "What if" filters the list to that customer (selected month or "All months shown"), with a "Showing <customer> · Clear" chip.
- Per-invoice switches become tick boxes: header "Select all" (only rows currently shown; indeterminate when partly ticked), row ticks, a count ("3 selected · A$…"), and "Exclude selected (not paid)" / "Include selected" buttons. Excluded rows stay greyed with an "Excluded" tag.
- Writes still go through the existing audited exclusion functions (no access change).

## B. Adjustments panel (above results; live recompute, no Xero writes)
Rows you can add, edit or remove:
- **Hire:** name/role; annual salary or hourly × hours/week; super at 12% (editable); optional on-cost %; start and optional end month. Monthly = salary/12 (or hourly × hours × 52/12) × (1 + super% + on-cost%). Added to Wages (fixed). Shows "+A$X/month incl. super".
- **Price / sales change:** ±% on income, or on chosen customers, from a month.
- **New regular cost:** description, A$/month, start/end, Fixed or Variable.
- **Cut an existing cost:** an expense account or Account setup group, by % or A$, from a month.
- **Customers pay slower:** shift expected receipts by n days.
- **One-off purchase** (amount, month); **cash injection / loan** (amount, month, optional monthly repayment).

Results: Baseline vs Scenario side by side for the chosen month and the next 3–6 months (net position; closing cash where a saved bank balance exists), plus break-even impact ("needs A$X more sales per month"). Everything is labelled "Projection". Cost groups come from Account setup (Wages / Fixed / Variable / Leave out) through the existing reader.

## C. Saved scenarios
- Save named scenarios per client: adjustments + invoice exclusions + cost-basis choices. Load, rename, duplicate, delete. Name shown at the top, plus a "Compare with baseline" view.
- Only people who can manage the client save, rename, duplicate, delete or share (existing client-write rule; two-step verification; audited set/renamed/deleted/shared).
- "Share with client" is off by default. When on, Business Owners of that exact client can open it read-only (option 1).
- Monthly report: optional "Include scenario in report" picker on new drafts only, off by default, freezing a small Baseline vs Scenario table into the draft. Final/sent reports untouched.

## D. Look
White boxes on the grey page, brand palette, adjustments stack on mobile, tables scroll inside their card.

## Tests
Customer filter shows only that customer; Select all respects the filter; hire maths (salary and hourly, 12% super, on-cost); saved scenario round-trip; Business Owner cannot edit; shared flag respected (unshared hidden from Business Owner; Viewer always denied under option 1). Then code check, build, all tests, `bun run security:check`, security posture and linter.

## Technical details
- New table `client_cashflow_scenarios` (id, client_id, name, payload jsonb with a size limit, shared_with_client bool default false, created_by, timestamps). RLS on; `revoke all from anon, authenticated`; SELECT only.
- SELECT policy, `to authenticated`: `app_private.user_can_write_client(auth.uid(), client_id)` OR (`shared_with_client` AND caller has a `business_owner` `client_access` row for that client, through an existing database predicate). No write policies.
- Writes through SECURITY DEFINER RPCs (`save_cashflow_scenario`, `delete_cashflow_scenario`, `set_cashflow_scenario_shared`): `SET search_path`, `app_private.assert_aal2()`, client-write guard first, client resolved from the row, audit_log entries; EXECUTE revoked from PUBLIC/anon.
- Pure maths in `src/lib/scenario/adjustments.ts` (shared by page, report and tests).
- Report: the picker stores the scenario id on the draft; generation freezes the computed table into the draft snapshot.
- Update the access matrix, definer register, security backlog and fixture dumps.
- Real Demo Company / Positive Traction snapshot figures are used in the final report, not fixture numbers.
