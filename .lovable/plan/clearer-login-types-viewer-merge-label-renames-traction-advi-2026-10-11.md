# Clearer login types: Viewer merge, label renames, "Traction Advisory looks after this organisation"

Classification: SECURITY-RELEVANT (Part A touches viewer read paths; Part C changes who becomes a member of a new organisation).

## Finding before building (live database, read today)

All seven tables named in Part A already allow a Selected-clients adviser to read their granted client. Each has a SELECT policy `to authenticated` using `app_private.has_client_read_access`, which is "specific `client_access` row OR All-clients grant":
client_cost_classifications, client_statutory_accounts, client_true_breakeven_inputs, client_income_tax_instalments, client_xero_orgs, unreconciled_lines, unreconciled_uploads.

So the database probably needs **no read widening**. If there is a real difference, it is in a server function or a card check that asks for the All-clients grant. Step A1 finds it. Only that gap gets fixed, using the same exact-client read check. No new predicate, no write.

## A. One "Viewer" type

- A1. Audit (no code changes): for each of the seven data sets, run the matrix as a Selected viewer and as an All-clients viewer on the same client. Also check the server functions and card gating that serve those screens. List every place where the result differs.
- A2. Fix each difference by switching that read to `has_client_read_access` / `user_can_read_client`. Read paths only. Static guard 11 must stay green.
- A3. Invite and edit screens: one type, "Viewer (read-only)", with a scope choice: "All clients (includes clients added later)" or "Selected clients" (tick list). Business Owner stays a separate choice and is only for selected clients.
- A4. "Change access" on the person's People row. Uses existing audited functions only:
  - All → Selected: `grant_client_access` for each ticked client (relationship `external_adviser`), then `revoke_firm_viewer_access`. Done in one new caller-scoped wrapper so access never widens in the middle.
  - Selected → All: `grant_firm_viewer_access`, then remove the per-client adviser rows.
  - The wrapper is a definer with aal2, the `can_manage_client_viewers` guard first, `auth.uid()` only, execute revoked from PUBLIC/anon, audited, and registered.
- A5. People lists, filters and labels show "Viewer · All clients" or "Viewer · N clients". Rows where relationship is NULL still show "Not set" and stay read-only, with no backfill.
- Storage is unchanged: `firm_viewer_access` = All clients, `client_access` with `external_adviser` = Selected. No data migration, so nobody gains or loses a client.

## B. Labels only (internal keys unchanged)

| Old label | New label |
|---|---|
| Super admin | System Administrator |
| Practice team | Traction Advisory team |
| Organisation owner | Organisation Owner |
| Organisation staff | Staff |
| Business owner | Business Owner |

- The System Administrator description will say: "Runs the platform. Gives no access to organisation or client data by itself."
- Support access is shown as a temporary pass, not a login type.
- These labels change in the UI, email templates, Trixie's guide and help seed text, and docs. Last-administrator protection is unchanged. No Manager role.

## C. "Traction Advisory looks after this organisation" checkbox

- The checkbox appears on both Add organisation paths and is ticked by default.
- A new boolean parameter `p_add_practice_team` (default true) goes on the manual create function and on `admin_onboard_organisation_from_xero`. When it is false, no practice-team memberships are created.
- The value is recorded in each function's existing audit event, and stored as `firms.managed_by_traction` (boolean, default true; existing rows true). It is a display flag only and is never used to grant access.
- System Admin organisation detail shows "Looked after by Traction Advisory: Yes/No".
- Risk to confirm: an unticked organisation that also has no owner email is reachable by nobody until an owner is invited. The plan allows this, with a warning on the Review screen.

## D. Docs and records

- AGENTS.md: one rule ("Viewer is one read-only type; scope is All clients or Selected; storage keys unchanged").
- The access-control spec gets a new "Who can log in" section listing: System Administrator, Traction Advisory team, Organisation Owner, Staff, Viewer (All/Selected), Business Owner, and Support access as a temporary pass.
- Access matrix rows:
  - Selected Viewer: allowed on the granted client including all seven tables; denied on other clients, other organisations and every write.
  - All-clients Viewer: allowed across the organisation, including a client added after the grant.
  - Switching All→Selected removes the rest immediately; revoking works for both.
  - Unticked onboarding adds no practice-team member.
- Definer register (new wrapper, changed signatures) and the security backlog are updated.

## Checks

tsgo, build, app tests, `bun run security:check`, `security_posture()`, linter, live access proofs, and a Security report listing every access change.

## Technical details

- Migrations:
  1. The viewer-scope switch wrapper.
  2. The new `p_add_practice_team` parameter on both create definers. Uses drop+create with the same grants so no old overload is left behind.
  3. The `firms.managed_by_traction` column, with grants unchanged.
- Files: viewer invite/People components and `src/lib/viewers.functions.ts`; the role label map; the Add organisation dialogs and `admin-onboard` server functions; System Admin organisation detail; Trixie guide and seed; email templates; docs listed above.
- Not changed: `src/routes/api/public/xero/signup.ts`, Business Owner permissions, and support grants.
