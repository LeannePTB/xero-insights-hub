# Access matrix

> GENERATED FILE — do not edit. Source of truth: `docs/security/access-matrix.ts`.
> Regenerate with `bun run scripts/render-access-matrix.ts`.

Rows: **1253**. Known failures: **28**.

`ALLOW`/`DENY` is the EXPECTED result. A row marked KNOWN FAILURE describes behaviour that is wrong today:
the suites report it every run with its backlog number and never count it as a pass.

## Known failures

| Backlog | Role | Resource | Operation | Why it fails |
| --- | --- | --- | --- | --- |
| 18 | Support-grant holder, active, non-member organisation | client_access | insert | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | client_access | update | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | client_access | delete | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | client_cost_classifications | insert | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | client_cost_classifications | update | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | client_cost_classifications | delete | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | client_notes | insert | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | client_notes | update | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | client_notes | delete | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | client_true_breakeven_inputs | insert | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | client_true_breakeven_inputs | update | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | client_true_breakeven_inputs | delete | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | client_xero_orgs | insert | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | client_xero_orgs | update | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | client_xero_orgs | delete | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | loan_consolidation_accounts | insert | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | loan_consolidation_accounts | update | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | loan_consolidation_accounts | delete | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | tier_widget_config | insert | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | tier_widget_config | update | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | tier_widget_config | delete | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | unreconciled_lines | insert | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | unreconciled_lines | update | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | unreconciled_lines | delete | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | unreconciled_uploads | insert | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | unreconciled_uploads | update | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | unreconciled_uploads | delete | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| 18 | Support-grant holder, active, non-member organisation | server fn: write client data | execute | Shared gate app_private.user_can_manage_client still admits the support path. |

## Anonymous (no session)

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| firms | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_connections.access_token_enc | read | DENY | pglite, live | PK 8; Spec §10 (no column grant; privilege check precedes RLS) |  |
| xero_connections.refresh_token_enc | read | DENY | pglite, live | PK 8; Spec §10 (no column grant; privilege check precedes RLS) |  |
| xero_connections (non-token columns) | read | DENY | pglite, live | PK 3, PK 4 |  |
| profiles | read | DENY | pglite, live | PK 1 |  |
| user_presence | read | DENY | pglite, live | Phase 1b follow-up (anon holds no privilege) |  |

## Active member, aal1 session only

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| firms | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_connections (non-token columns) | read | DENY | pglite, live | PK 3, PK 4 |  |
| public.user_can_access_firm() | execute | DENY | pglite, live | PK 2 (assert_aal2 guard is the first statement) |  |
| public.user_can_access_client() | execute | DENY | pglite, live | PK 2 (assert_aal2 guard is the first statement) |  |
| public.client_entitlement() | execute | DENY | pglite, live | PK 2 (assert_aal2 guard is the first statement) |  |
| public.assert_client_write_access() | execute | DENY | pglite, live | PK 2 (assert_aal2 guard is the first statement) |  |
| public.set_client_widget_enabled() | execute | DENY | pglite, live | PK 2 (assert_aal2 guard is the first statement) |  |
| public.delete_client_report() | execute | DENY | pglite, live | PK 2 (assert_aal2 guard is the first statement) |  |
| public.transfer_organisation_ownership() | execute | DENY | pglite, live | PK 2 (assert_aal2 guard is the first statement) |  |
| public.set_all_client_tiers() | execute | DENY | pglite, live | PK 2 (assert_aal2 guard is the first statement) |  |
| public.security_posture() | execute | DENY | pglite, live | PK 2 (assert_aal2 guard is the first statement) |  |
| public.online_users() | execute | DENY | pglite, live | PK 2 (assert_aal2 guard is the first statement) |  |
| public.set_profile_display_name_admin() | execute | DENY | pglite, live | PK 2 (assert_aal2 guard is the first statement) |  |
| server fn: list clients for an organisation | execute | DENY | live | PK 2 (requireAal2) |  |
| server fn: read Xero data for a client | execute | DENY | live | PK 2 (requireAal2) |  |
| server fn: write client data | execute | DENY | live | PK 2 (requireAal2) |  |
| server fn: invite a member | execute | DENY | live | PK 2 (requireAal2) |  |
| server fn: transfer ownership | execute | DENY | live | PK 2 (requireAal2) |  |

## Active member of a DIFFERENT organisation

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| firms | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_connections (non-token columns) | read | DENY | pglite, live | PK 3, PK 4 |  |
| plan_levels | insert | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| plan_levels | update | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| plan_levels | delete | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| tier_settings | insert | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| tier_settings | update | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| tier_settings | delete | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| server fn: list clients for an organisation | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: read Xero data for a client | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: write client data | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: invite a member | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: transfer ownership | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |

## Organisation A's owner, reading organisation B

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| firms | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |

## Member with status = suspended

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| firms | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| server fn: list clients for an organisation | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: read Xero data for a client | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: write client data | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: invite a member | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: transfer ownership | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |

## Member with status = removed

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| firms | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| server fn: list clients for an organisation | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: read Xero data for a client | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: write client data | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: invite a member | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: transfer ownership | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |

## Super admin with NO membership

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| firms | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_connections.access_token_enc | read | DENY | pglite, live | PK 8; Spec §10 (no column grant; privilege check precedes RLS) |  |
| xero_connections.refresh_token_enc | read | DENY | pglite, live | PK 8; Spec §10 (no column grant; privilege check precedes RLS) |  |
| xero_connections (non-token columns) | read | DENY | pglite, live | PK 3, PK 4 |  |
| audit_log | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| audit_log | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| audit_log | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| login_events | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| login_events | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| login_events | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_api_errors | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_api_errors | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_api_errors | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| admin_firm_overview | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| plan_levels | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| tier_settings | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| signup_requests | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| access_invites | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| user_roles | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| audit_log | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| xero_api_errors | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| billing_events | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| xero_snapshots | read | DENY | pglite, live | PK 3 (super_admin grants ZERO client data on its own) |  |
| client_reports | read | DENY | pglite, live | PK 3 (super_admin grants ZERO client data on its own) |  |
| report_cache | read | DENY | pglite, live | PK 3 (super_admin grants ZERO client data on its own) |  |
| reconciliation_snapshots | read | DENY | pglite, live | PK 3 (super_admin grants ZERO client data on its own) |  |
| public.online_users() | execute | ALLOW | pglite, live | PK 2 path C metadata |  |
| public.set_all_client_tiers() | execute | DENY | live | PK 3 — needs the organisation's data, super admin alone is not access | Backlog 19 records that this now gates on is_super_admin; revisit when the shared gate rule is decided. |
| server fn: list clients for an organisation | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: read Xero data for a client | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: write client data | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: invite a member | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: transfer ownership | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |

## Support-grant holder, grant expired

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| firms | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_support_access (expired grant used for a read) | read | DENY | pglite, live | Spec §7 (max 72h, expires_at enforced) |  |

## Support-grant holder, grant revoked

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| firms | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firms | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| clients | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_xero_orgs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_notes | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_access | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_cost_classifications | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_true_breakeven_inputs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_statutory_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_subscriptions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| client_reports | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| reconciliation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_uploads | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| unreconciled_lines | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_accounts | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| loan_consolidation_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_groups | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| consolidation_group_members | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| tier_widget_config | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshots | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| xero_snapshot_runs | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| report_cache | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | read | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | insert | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | update | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| scenario_exclusions | delete | DENY | pglite, live | PK 1, PK 2, PK 3, PK 4; Spec §0.3 |  |
| firm_support_access (revoked grant used for a read) | read | DENY | pglite, live | Spec §7 (revoked_at) |  |

## Organisation owner (own organisation)

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| firms | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| firm_members | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| clients | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| client_xero_orgs | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| client_notes | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| client_access | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| client_cost_classifications | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| client_true_breakeven_inputs | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| client_statutory_accounts | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| client_subscriptions | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| client_reports | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| reconciliation_snapshots | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| unreconciled_uploads | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| unreconciled_lines | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| loan_consolidation_accounts | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| loan_consolidation_snapshots | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| consolidation_groups | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| consolidation_group_members | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| tier_widget_config | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| xero_snapshots | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| xero_snapshot_runs | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| report_cache | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| scenario_exclusions | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| clients | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| clients | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| clients | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_xero_orgs | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_xero_orgs | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_xero_orgs | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_notes | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_notes | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_notes | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_access | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_access | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_access | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_cost_classifications | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_cost_classifications | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_cost_classifications | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_true_breakeven_inputs | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_true_breakeven_inputs | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_true_breakeven_inputs | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_statutory_accounts | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_statutory_accounts | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_statutory_accounts | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_subscriptions | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_subscriptions | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_subscriptions | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_reports | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_reports | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_reports | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| reconciliation_snapshots | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| reconciliation_snapshots | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| reconciliation_snapshots | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| unreconciled_uploads | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| unreconciled_uploads | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| unreconciled_uploads | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| unreconciled_lines | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| unreconciled_lines | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| unreconciled_lines | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| loan_consolidation_accounts | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| loan_consolidation_accounts | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| loan_consolidation_accounts | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| loan_consolidation_snapshots | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| loan_consolidation_snapshots | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| loan_consolidation_snapshots | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| consolidation_groups | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| consolidation_groups | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| consolidation_groups | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| consolidation_group_members | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| consolidation_group_members | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| consolidation_group_members | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| tier_widget_config | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| tier_widget_config | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| tier_widget_config | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| xero_snapshots | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| xero_snapshots | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| xero_snapshots | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| xero_snapshot_runs | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| xero_snapshot_runs | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| xero_snapshot_runs | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| report_cache | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| report_cache | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| report_cache | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| scenario_exclusions | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| scenario_exclusions | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| scenario_exclusions | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| xero_connections.access_token_enc | read | DENY | pglite, live | PK 8; Spec §10 (no column grant; privilege check precedes RLS) |  |
| xero_connections.refresh_token_enc | read | DENY | pglite, live | PK 8; Spec §10 (no column grant; privilege check precedes RLS) |  |
| xero_connections (non-token columns) | read | ALLOW | pglite, live | Spec §10 |  |
| audit_log | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| audit_log | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| audit_log | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| login_events | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| login_events | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| login_events | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_api_errors | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_api_errors | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_api_errors | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| audit_log | read | ALLOW | pglite, live | Spec §3 own organisation's audit rows |  |
| server fn: list clients for an organisation | execute | ALLOW | live | PK 2 path A |  |
| server fn: write client data | execute | ALLOW | live | PK 2 path A |  |
| server fn: invite a member | execute | ALLOW | live | PK 2 path A |  |

## Organisation staff (own organisation)

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| firms | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| firm_members | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| clients | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| client_xero_orgs | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| client_notes | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| client_access | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| client_cost_classifications | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| client_true_breakeven_inputs | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| client_statutory_accounts | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| client_subscriptions | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| client_reports | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| reconciliation_snapshots | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| unreconciled_uploads | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| unreconciled_lines | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| loan_consolidation_accounts | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| loan_consolidation_snapshots | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| consolidation_groups | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| consolidation_group_members | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| tier_widget_config | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| xero_snapshots | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| xero_snapshot_runs | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| report_cache | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| scenario_exclusions | read | ALLOW | pglite, live | PK 2 path A; Spec §3 |  |
| clients | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| clients | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| clients | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_xero_orgs | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_xero_orgs | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_xero_orgs | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_notes | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_notes | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_notes | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_access | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_access | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_access | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_cost_classifications | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_cost_classifications | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_cost_classifications | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_true_breakeven_inputs | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_true_breakeven_inputs | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_true_breakeven_inputs | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_statutory_accounts | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_statutory_accounts | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_statutory_accounts | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_subscriptions | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_subscriptions | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_subscriptions | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_reports | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_reports | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_reports | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| reconciliation_snapshots | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| reconciliation_snapshots | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| reconciliation_snapshots | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| unreconciled_uploads | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| unreconciled_uploads | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| unreconciled_uploads | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| unreconciled_lines | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| unreconciled_lines | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| unreconciled_lines | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| loan_consolidation_accounts | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| loan_consolidation_accounts | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| loan_consolidation_accounts | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| loan_consolidation_snapshots | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| loan_consolidation_snapshots | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| loan_consolidation_snapshots | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| consolidation_groups | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| consolidation_groups | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| consolidation_groups | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| consolidation_group_members | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| consolidation_group_members | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| consolidation_group_members | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| tier_widget_config | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| tier_widget_config | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| tier_widget_config | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| xero_snapshots | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| xero_snapshots | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| xero_snapshots | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| xero_snapshot_runs | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| xero_snapshot_runs | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| xero_snapshot_runs | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| report_cache | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| report_cache | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| report_cache | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| scenario_exclusions | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| scenario_exclusions | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| scenario_exclusions | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| xero_connections.access_token_enc | read | DENY | pglite, live | PK 8; Spec §10 (no column grant; privilege check precedes RLS) |  |
| xero_connections.refresh_token_enc | read | DENY | pglite, live | PK 8; Spec §10 (no column grant; privilege check precedes RLS) |  |
| xero_connections (non-token columns) | read | ALLOW | pglite, live | Spec §10 |  |
| audit_log | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| audit_log | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| audit_log | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| login_events | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| login_events | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| login_events | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_api_errors | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_api_errors | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_api_errors | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| plan_levels | insert | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| plan_levels | update | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| plan_levels | delete | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| tier_settings | insert | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| tier_settings | update | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| tier_settings | delete | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| profiles (own row, display_name) | update | ALLOW | pglite, live | Phase 1b follow-up; column grant UPDATE(display_name) only |  |
| profiles (own row, email) | update | DENY | pglite, live | Phase 1b follow-up; verified email comes from auth.users |  |
| profiles (another user's row) | update | DENY | pglite, live | PK 1 deny by default |  |
| profiles (any row) | insert | DENY | pglite, live | handle_new_user() is the only writer |  |
| user_presence (own row) | insert | ALLOW | pglite, live | Phase 1b (heartbeat); server sets last_seen_at |  |
| user_presence (another user's row) | update | DENY | pglite, live | PK 1 |  |
| user_presence (own row, forged last_seen_at) | update | DENY | pglite, live | Phase 1b correction: set_presence_seen_at() trigger overwrites | Denied in effect: the write succeeds but the forged value never persists. |
| public.online_users() | execute | DENY | pglite, live | PK 2 path C; super admin + aal2 only |  |
| server fn: requestSupportAccess (own pending request) | insert | ALLOW | live | Spec §7 |  |
| server fn: approveSupportAccess | update | DENY | live | Spec §7 (only is_org_owner may approve) |  |
| public.transfer_organisation_ownership() | execute | DENY | pglite, live | Spec §4 (current owner only) |  |
| public.set_profile_display_name_admin() | execute | DENY | pglite, live | PK 2 path C; super admin only |  |
| public.security_posture() | execute | DENY | pglite, live | PK 2 path C; super admin only |  |

## Support-grant holder, active, non-member organisation

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| firms | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| firm_members | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| clients | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| client_xero_orgs | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| client_notes | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| client_access | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| client_cost_classifications | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| client_true_breakeven_inputs | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| client_statutory_accounts | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| client_subscriptions | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| client_reports | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| reconciliation_snapshots | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| unreconciled_uploads | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| unreconciled_lines | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| loan_consolidation_accounts | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| loan_consolidation_snapshots | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| consolidation_groups | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| consolidation_group_members | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| tier_widget_config | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| xero_snapshots | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| xero_snapshot_runs | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| report_cache | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| scenario_exclusions | read | ALLOW | pglite, live | PK 2 path B; Spec §3, §7 |  |
| client_access | insert | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| client_access | update | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| client_access | delete | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| client_cost_classifications | insert | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| client_cost_classifications | update | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| client_cost_classifications | delete | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| client_notes | insert | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| client_notes | update | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| client_notes | delete | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| client_true_breakeven_inputs | insert | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| client_true_breakeven_inputs | update | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| client_true_breakeven_inputs | delete | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| client_xero_orgs | insert | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| client_xero_orgs | update | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| client_xero_orgs | delete | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| loan_consolidation_accounts | insert | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| loan_consolidation_accounts | update | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| loan_consolidation_accounts | delete | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| tier_widget_config | insert | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| tier_widget_config | update | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| tier_widget_config | delete | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| unreconciled_lines | insert | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| unreconciled_lines | update | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| unreconciled_lines | delete | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| unreconciled_uploads | insert | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| unreconciled_uploads | update | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| unreconciled_uploads | delete | DENY **KNOWN FAILURE (backlog 18)** | pglite, live | PK 5 (support grants are READ-ONLY) | app_private.user_can_manage_client still admits is_super_admin AND platform_staff_can_access_firm; nine FOR ALL policies and app_private.move_xero_file_to_client depend on it, so an active support grant can still write. |
| clients | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| clients | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| clients | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| client_statutory_accounts | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| client_statutory_accounts | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| client_statutory_accounts | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| client_subscriptions | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| client_subscriptions | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| client_subscriptions | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| client_reports | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| client_reports | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| client_reports | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| reconciliation_snapshots | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| reconciliation_snapshots | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| reconciliation_snapshots | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| loan_consolidation_snapshots | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| loan_consolidation_snapshots | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| loan_consolidation_snapshots | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| consolidation_groups | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| consolidation_groups | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| consolidation_groups | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| consolidation_group_members | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| consolidation_group_members | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| consolidation_group_members | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| xero_snapshots | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| xero_snapshots | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| xero_snapshots | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| xero_snapshot_runs | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| xero_snapshot_runs | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| xero_snapshot_runs | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| report_cache | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| report_cache | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| report_cache | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| scenario_exclusions | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| scenario_exclusions | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| scenario_exclusions | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) |  |
| xero_connections.access_token_enc | read | DENY | pglite, live | PK 8; Spec §10 (no column grant; privilege check precedes RLS) |  |
| xero_connections.refresh_token_enc | read | DENY | pglite, live | PK 8; Spec §10 (no column grant; privilege check precedes RLS) |  |
| audit_log | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| audit_log | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| audit_log | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| login_events | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| login_events | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| login_events | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_api_errors | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_api_errors | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_api_errors | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| server fn: write client data | execute | DENY **KNOWN FAILURE (backlog 18)** | live | PK 5 (support grants are READ-ONLY) | Shared gate app_private.user_can_manage_client still admits the support path. |

## Client viewer (client_access on one client)

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| clients | read | ALLOW | pglite, live | Spec §3 client viewer |  |
| client_notes | read | ALLOW | pglite, live | Spec §3 client viewer |  |
| firms | read | DENY | pglite, live | Spec §3 client viewer sees only that client |  |
| firm_members | read | DENY | pglite, live | Spec §3 client viewer sees only that client |  |
| audit_log | read | DENY | pglite, live | Spec §3 client viewer sees only that client |  |
| subscriptions | read | DENY | pglite, live | Spec §3 client viewer sees only that client |  |
| clients | insert | DENY | pglite, live | Spec §3 |  |
| clients | update | DENY | pglite, live | Spec §3 |  |
| clients | delete | DENY | pglite, live | Spec §3 |  |
| client_access | insert | DENY | pglite, live | Spec §3 |  |
| client_access | update | DENY | pglite, live | Spec §3 |  |
| client_access | delete | DENY | pglite, live | Spec §3 |  |
| xero_connections.access_token_enc | read | DENY | pglite, live | PK 8; Spec §10 (no column grant; privilege check precedes RLS) |  |
| xero_connections.refresh_token_enc | read | DENY | pglite, live | PK 8; Spec §10 (no column grant; privilege check precedes RLS) |  |
| audit_log | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| audit_log | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| audit_log | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| login_events | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| login_events | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| login_events | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_api_errors | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_api_errors | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_api_errors | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| plan_levels | insert | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| plan_levels | update | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| plan_levels | delete | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| tier_settings | insert | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| tier_settings | update | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| tier_settings | delete | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |

## Super admin approving their own support grant

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| server fn: approveSupportAccess (own request) | update | DENY | pglite, live | PK 2 path B; Spec §7 (a super admin never approves their own access) |  |
