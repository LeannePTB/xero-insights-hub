# Close the organisation card-defaults MFA gap

## Classification and threat

SECURITY-RELEVANT. `org_card_defaults` contains organisation configuration. RLS is enabled and its read policy is limited to signed-in users with organisation access, but the table lacks the standard restrictive `mfa_aal2_required` policy. The threat is an aal1 session reaching rows through an otherwise-permitted policy. A second threat is future public tables shipping with missing MFA enforcement or unnecessary `anon` / `authenticated` privileges.

## Changes

1. Add the standard restrictive `mfa_aal2_required` policy to `public.org_card_defaults`, using `app_private.is_aal2()` for both row visibility and writes, and naming the `authenticated` role exactly like the other protected tables.
2. Add a pre-release static guard over the checked-in live schema fixture:
   - fail when any in-scope public data table lacks the restrictive `mfa_aal2_required` policy;
   - fail when `anon` has any table privilege unless the table is explicitly documented as public;
   - fail when `authenticated` has privileges beyond the per-table allow-list derived from the intended policies/system-only write paths;
   - keep the two documented MFA exclusions (`plan_levels`, `tier_settings`) and necessary grant exceptions explicit, so adding a table cannot pass accidentally.
3. Wire the guard into `bun run security:check` before the broader test suite.
4. Refresh the checked-in live schema fixture after the migration and add regression tests proving:
   - removing the MFA policy from a fixture fails;
   - adding an unnecessary default grant fails;
   - `org_card_defaults`, `user_presence`, and `security_test_runs` carry only their intended privileges.
5. Update the security backlog/report with the defect, remediation, invariants, and evidence.

## Verification

- Confirm live `org_card_defaults` has RLS plus the restrictive aal2 policy.
- Run the new guard against deliberately broken fixtures and confirm both failure modes.
- Run `bun run security:check` with zero unexpected failures and unchanged known failures.
- Run `public.security_posture()` through its authorised application path and confirm the MFA-table check returns OK.
- Run the database linter and confirm no new Action or Warn findings.
- Re-query every public table to confirm no other in-scope table lacks the guard and no unnecessary default grants remain.
