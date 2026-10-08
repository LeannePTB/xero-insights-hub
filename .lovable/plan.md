# Advisory tax obligations card

## Goal
Add a new **Tax obligations** card in the Advisory section that clearly combines:

- **GST:** the net GST for the latest completed GST period, using the existing Activity statement calculation.
- **PAYG withholding:** the amount for the latest completed PAYG month, not the total outstanding balance.
- **Income tax instalment:** the latest saved ATO-set amount, kept by period so prior amounts are retained.

For the September example, the card would show GST **$2,211.73** and PAYG withholding **A$2,437.00**, plus the saved income tax instalment for its applicable period.

## Card experience
- Add the card as an Advisory card and place it with the existing statutory cards.
- Show each figure with its own period label because GST and PAYG periods may differ.
- Reuse the existing GST and PAYG results; do not add another Xero endpoint or refresh call.
- Provide a period and currency-amount editor for the income tax instalment.
- Show a clear “Not entered” state when no instalment has been saved; zero remains a valid saved amount.
- Organisation owners and active team members can edit. A business owner can edit only their exact client. External advisers and support access remain read-only.

## Security rule amendment
Amend Access Path E to permit a business owner to read and maintain **only the income tax instalment periods for their exact client**. This does not grant access to another client, organisation settings, Xero connections, roles, billing, or any broader write capability.

Threats addressed:
- A caller-supplied client or Xero file being treated as permission.
- A business owner changing another client’s amount.
- A support grant or external adviser gaining write access.
- A bare super admin gaining client-data access.
- A write occurring without second-factor verification or an audit trail.

## Secure storage and server behaviour
- Add a dedicated client income-tax-instalment table because the amounts require period history rather than one replaceable value.
- Store client, Xero file, period start/end, amount, author and timestamps; enforce one amount per client/file/period and non-negative currency values.
- Revoke default access, grant only the minimum required privileges, enable RLS, and add explicit signed-in policies.
- Reads use the existing caller-scoped client-read rule and require AAL2.
- Writes go through one caller-scoped database function that:
  - asserts AAL2 first;
  - verifies the Xero file belongs to the client;
  - permits only an active organisation owner/team member or the business owner for that exact client;
  - rejects external advisers, support access, unrelated organisations and super-admin status alone;
  - saves atomically and records an audit event without exposing unrelated financial data.
- Wrap reads and writes in Zod-validated server functions using the signed-in caller’s session; never accept a user ID as authority.

## Catalogue and entitlement
- Add a built card key and label for **Tax obligations** to the Advisory catalogue and default order.
- Enable it for existing eligible Advisory dashboards so the requested card appears, while preserving the existing entitlement intersection and per-client card controls.
- Do not change who can see the underlying GST or PAYG cards or figures.

## Verification
- Add calculation tests proving the card uses net GST and the completed PAYG month amount, including the September values **$2,211.73** and **$2,437.00**.
- Add validation tests for periods, non-negative amounts, zero, and maximum currency precision.
- Extend the access matrix for the new table/function: exact-client business-owner write allowed; organisation owner/team write allowed; external adviser/support/cross-organisation/bare-super-admin writes denied; all AAL1 and idle sessions denied.
- Verify the audit row and confirm a caller-supplied alternative client or Xero file cannot take effect.
- Run the focused tests, full security check, database posture check and linter, then verify the card and save/read-back flow in a real AAL2 session.
- Update the security backlog with only results verified during implementation.

## Technical scope
Expected changes include the advisory dashboard card and catalogue, one additive database migration, generated database types, validated server functions, the binding access rules and matrix evidence, tests, and security documentation. Existing GST/PAYG calculations and Xero refresh behaviour remain unchanged.
