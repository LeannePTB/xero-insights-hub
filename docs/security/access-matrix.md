# Access matrix

> GENERATED FILE — do not edit. Source of truth: `docs/security/access-matrix.ts`.
> Regenerate with `bun run scripts/render-access-matrix.ts`.

Rows: **1282**. Known failures: **0**.

`ALLOW`/`DENY` is the EXPECTED result. A row marked KNOWN FAILURE describes behaviour that is wrong today:
the suites report it every run with its backlog number and never count it as a pass.

## Known failures

None.

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
| server fn: accept an owner invite while the organisation already has an owner | execute | DENY | live | Spec §4 — accepting an invite never replaces a sitting owner | acceptInvite sets firms.owner_user_id only while it is null (the organisation-creation flow) and writes an audit row when it does; otherwise the person joins as a member and ownership is untouched. |

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
| public.user_can_disconnect_xero_connection() | execute | DENY | live | PK 2 (aal2), PK 5 (support grants are read-only), PK 3, PK 4 | Phase 5: disconnecting a Xero file is a write. Membership or client-write only; the connection's firm and client are resolved server-side from the connection id. |
| public.client_xero_files_used() | execute | DENY | live | PK 2 (aal2), PK 3, PK 4 |  |
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
| public.user_can_disconnect_xero_connection() | execute | DENY | live | PK 2 (aal2), PK 5 (support grants are read-only), PK 3, PK 4 | Phase 5: disconnecting a Xero file is a write. Membership or client-write only; the connection's firm and client are resolved server-side from the connection id. |
| public.client_xero_files_used() | execute | DENY | live | PK 2 (aal2), PK 3, PK 4 |  |
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
| public.user_can_disconnect_xero_connection() | execute | DENY | live | PK 2 (aal2), PK 5 (support grants are read-only), PK 3, PK 4 | Phase 5: disconnecting a Xero file is a write. Membership or client-write only; the connection's firm and client are resolved server-side from the connection id. |

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
| public.user_can_disconnect_xero_connection() | execute | DENY | live | PK 2 (aal2), PK 5 (support grants are read-only), PK 3, PK 4 | Phase 5: disconnecting a Xero file is a write. Membership or client-write only; the connection's firm and client are resolved server-side from the connection id. |
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
| public.user_can_disconnect_xero_connection() | execute | DENY | live | PK 2 (aal2), PK 5 (support grants are read-only), PK 3, PK 4 | Phase 5: disconnecting a Xero file is a write. Membership or client-write only; the connection's firm and client are resolved server-side from the connection id. |
| server fn: list clients for an organisation | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: read Xero data for a client | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: write client data | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: invite a member | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: transfer ownership | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |

## Super admin with NO membership

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| clients | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| clients | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| clients | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| clients | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_xero_orgs | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_xero_orgs | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_xero_orgs | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_xero_orgs | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_notes | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_notes | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_notes | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_notes | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_access | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_access | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_access | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_access | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_cost_classifications | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_cost_classifications | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_cost_classifications | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_cost_classifications | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_true_breakeven_inputs | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_true_breakeven_inputs | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_true_breakeven_inputs | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_true_breakeven_inputs | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_statutory_accounts | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_statutory_accounts | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_statutory_accounts | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_statutory_accounts | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_reports | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_reports | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_reports | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_reports | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| reconciliation_snapshots | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| reconciliation_snapshots | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| reconciliation_snapshots | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| reconciliation_snapshots | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_uploads | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_uploads | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_uploads | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_uploads | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_lines | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_lines | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_lines | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_lines | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_accounts | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_accounts | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_accounts | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_accounts | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_snapshots | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_snapshots | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_snapshots | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_snapshots | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_groups | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_groups | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_groups | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_groups | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_group_members | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_group_members | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_group_members | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_group_members | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| tier_widget_config | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| tier_widget_config | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| tier_widget_config | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| tier_widget_config | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshots | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshots | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshots | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshots | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshot_runs | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshot_runs | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshot_runs | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshot_runs | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| report_cache | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| report_cache | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| report_cache | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| report_cache | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| scenario_exclusions | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| scenario_exclusions | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| scenario_exclusions | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| scenario_exclusions | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| firms | read | ALLOW | pglite, live | PK 2 path C; Spec §3 (organisation list) |  |
| firm_members | read | ALLOW | pglite, live | PK 2 path C; Spec §3 | Owner-approved Path C item (11 Sep 2026): the membership list is platform metadata, no financial data. |
| firms | update | DENY | pglite, live | PK 3; Spec §4 (ownership only via transfer_organisation_ownership; is_always_free only on the practice organisation, with a reason and an audit row) |  |
| firms | insert | DENY | pglite, live | Spec §4 (creation and membership go through their own functions) |  |
| firms | delete | DENY | pglite, live | Spec §4 (creation and membership go through their own functions) |  |
| firm_members | insert | DENY | pglite, live | Spec §4 (creation and membership go through their own functions) |  |
| firm_members | delete | DENY | pglite, live | Spec §4 (creation and membership go through their own functions) |  |
| client_subscriptions | read | ALLOW | pglite, live | PK 2 path C; Spec §8 (billing metadata, not Xero financial data) |  |
| client_subscriptions | insert | DENY | pglite, live | Spec §8 (a comp needs a reason and an audit row; a direct REST write carries neither) | Phase 3b closed backlog 28: the FOR ALL super-admin policy is dropped, authenticated holds SELECT only, and comps/trials/tier changes go through the audited aal2 functions set_client_comp, set_client_trial and set_client_dashboard_tier. Trigger audit_change records every row change. |
| client_subscriptions | update | DENY | pglite, live | Spec §8 (a comp needs a reason and an audit row; a direct REST write carries neither) | Phase 3b closed backlog 28: the FOR ALL super-admin policy is dropped, authenticated holds SELECT only, and comps/trials/tier changes go through the audited aal2 functions set_client_comp, set_client_trial and set_client_dashboard_tier. Trigger audit_change records every row change. |
| client_subscriptions | delete | DENY | pglite, live | Spec §8 (a comp needs a reason and an audit row; a direct REST write carries neither) | Phase 3b closed backlog 28: the FOR ALL super-admin policy is dropped, authenticated holds SELECT only, and comps/trials/tier changes go through the audited aal2 functions set_client_comp, set_client_trial and set_client_dashboard_tier. Trigger audit_change records every row change. |
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
| user_roles | insert | ALLOW | pglite, live | PK 2 path C; Spec §9 (audited by audit_user_roles_change) |  |
| user_roles | delete | ALLOW | pglite, live | PK 2 path C; Spec §9 (audited by audit_user_roles_change) |  |
| user_roles | update | ALLOW | pglite, live | PK 2 path C; Spec §9 (role changes are audited) | Phase 3b closed backlog 29 for this table: the generic AFTER trigger audit_change on user_roles records insert, update and delete with the actor and the changed columns, replacing audit_user_roles_change. |
| plan_levels | insert | ALLOW | pglite, live | PK 2 path C; Spec §9 (platform configuration changes leave an audit row) | Phase 3b closed backlog 29: the generic AFTER trigger audit_change records every row change on these tables with the actor and the changed columns. |
| plan_levels | update | ALLOW | pglite, live | PK 2 path C; Spec §9 (platform configuration changes leave an audit row) | Phase 3b closed backlog 29: the generic AFTER trigger audit_change records every row change on these tables with the actor and the changed columns. |
| plan_levels | delete | ALLOW | pglite, live | PK 2 path C; Spec §9 (platform configuration changes leave an audit row) | Phase 3b closed backlog 29: the generic AFTER trigger audit_change records every row change on these tables with the actor and the changed columns. |
| xero_assessment_contact | insert | ALLOW | pglite, live | PK 2 path C; Spec §9 (platform configuration changes leave an audit row) | Phase 3b closed backlog 29: the generic AFTER trigger audit_change records every row change on these tables with the actor and the changed columns. |
| xero_assessment_contact | update | ALLOW | pglite, live | PK 2 path C; Spec §9 (platform configuration changes leave an audit row) | Phase 3b closed backlog 29: the generic AFTER trigger audit_change records every row change on these tables with the actor and the changed columns. |
| xero_assessment_contact | delete | ALLOW | pglite, live | PK 2 path C; Spec §9 (platform configuration changes leave an audit row) | Phase 3b closed backlog 29: the generic AFTER trigger audit_change records every row change on these tables with the actor and the changed columns. |
| signup_requests | update | ALLOW | pglite, live | PK 2 path C; Spec §9 (platform metadata changes leave an audit row) | Phase 3b closed backlog 29: trigger audit_change on signup_requests records the actor and the changed columns. |
| public.online_users() | execute | ALLOW | pglite, live | PK 2 path C metadata |  |
| public.set_all_client_tiers() | execute | DENY | live | PK 3 — needs the organisation's data, super admin alone is not access | Backlog 19 records that this now gates on is_super_admin; revisit when the shared gate rule is decided. |
| public.user_can_disconnect_xero_connection() | execute | DENY | live | PK 2 (aal2), PK 5 (support grants are read-only), PK 3, PK 4 | Phase 5: disconnecting a Xero file is a write. Membership or client-write only; the connection's firm and client are resolved server-side from the connection id. |
| public.client_xero_files_used() | execute | DENY | live | PK 2 (aal2), PK 3, PK 4 |  |
| server fn: list clients for an organisation | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: read Xero data for a client | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: write client data | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: invite a member | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: transfer ownership | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: invite an owner to an existing organisation | execute | DENY | live | Spec §4 — ownership only moves through transfer_organisation_ownership | adminInviteFirmMember accepts role 'staff' only; an owner invitation to an existing organisation is refused with a pointer to ownership transfer. |

## Support-grant holder, grant expired

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| clients | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| clients | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| clients | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| clients | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_xero_orgs | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_xero_orgs | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_xero_orgs | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_xero_orgs | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_notes | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_notes | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_notes | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_notes | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_access | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_access | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_access | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_access | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_cost_classifications | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_cost_classifications | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_cost_classifications | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_cost_classifications | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_true_breakeven_inputs | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_true_breakeven_inputs | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_true_breakeven_inputs | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_true_breakeven_inputs | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_statutory_accounts | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_statutory_accounts | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_statutory_accounts | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_statutory_accounts | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_reports | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_reports | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_reports | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_reports | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| reconciliation_snapshots | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| reconciliation_snapshots | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| reconciliation_snapshots | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| reconciliation_snapshots | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_uploads | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_uploads | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_uploads | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_uploads | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_lines | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_lines | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_lines | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_lines | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_accounts | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_accounts | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_accounts | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_accounts | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_snapshots | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_snapshots | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_snapshots | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_snapshots | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_groups | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_groups | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_groups | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_groups | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_group_members | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_group_members | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_group_members | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_group_members | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| tier_widget_config | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| tier_widget_config | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| tier_widget_config | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| tier_widget_config | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshots | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshots | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshots | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshots | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshot_runs | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshot_runs | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshot_runs | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshot_runs | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| report_cache | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| report_cache | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| report_cache | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| report_cache | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| scenario_exclusions | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| scenario_exclusions | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| scenario_exclusions | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| scenario_exclusions | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| firms | read | ALLOW | pglite, live | PK 2 path C; Spec §3 (organisation list) |  |
| firm_members | read | ALLOW | pglite, live | PK 2 path C; Spec §3 | Owner-approved Path C item (11 Sep 2026): the membership list is platform metadata, no financial data. |
| firms | update | DENY | pglite, live | PK 3; Spec §4 (ownership only via transfer_organisation_ownership; is_always_free only on the practice organisation, with a reason and an audit row) |  |
| firms | insert | DENY | pglite, live | Spec §4 (creation and membership go through their own functions) |  |
| firms | delete | DENY | pglite, live | Spec §4 (creation and membership go through their own functions) |  |
| firm_members | insert | DENY | pglite, live | Spec §4 (creation and membership go through their own functions) |  |
| firm_members | delete | DENY | pglite, live | Spec §4 (creation and membership go through their own functions) |  |
| client_subscriptions | read | ALLOW | pglite, live | PK 2 path C; Spec §8 (billing metadata, not Xero financial data) |  |
| client_subscriptions | insert | DENY | pglite, live | Spec §8 (a comp needs a reason and an audit row; a direct REST write carries neither) | Phase 3b closed backlog 28: the FOR ALL super-admin policy is dropped, authenticated holds SELECT only, and comps/trials/tier changes go through the audited aal2 functions set_client_comp, set_client_trial and set_client_dashboard_tier. Trigger audit_change records every row change. |
| client_subscriptions | update | DENY | pglite, live | Spec §8 (a comp needs a reason and an audit row; a direct REST write carries neither) | Phase 3b closed backlog 28: the FOR ALL super-admin policy is dropped, authenticated holds SELECT only, and comps/trials/tier changes go through the audited aal2 functions set_client_comp, set_client_trial and set_client_dashboard_tier. Trigger audit_change records every row change. |
| client_subscriptions | delete | DENY | pglite, live | Spec §8 (a comp needs a reason and an audit row; a direct REST write carries neither) | Phase 3b closed backlog 28: the FOR ALL super-admin policy is dropped, authenticated holds SELECT only, and comps/trials/tier changes go through the audited aal2 functions set_client_comp, set_client_trial and set_client_dashboard_tier. Trigger audit_change records every row change. |
| firm_support_access (expired grant used for a read) | read | DENY | pglite, live | Spec §7 (max 72h, expires_at enforced) |  |

## Support-grant holder, grant revoked

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| clients | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| clients | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| clients | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| clients | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_xero_orgs | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_xero_orgs | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_xero_orgs | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_xero_orgs | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_notes | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_notes | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_notes | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_notes | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_access | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_access | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_access | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_access | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_cost_classifications | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_cost_classifications | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_cost_classifications | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_cost_classifications | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_true_breakeven_inputs | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_true_breakeven_inputs | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_true_breakeven_inputs | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_true_breakeven_inputs | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_statutory_accounts | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_statutory_accounts | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_statutory_accounts | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_statutory_accounts | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_reports | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_reports | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_reports | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| client_reports | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| reconciliation_snapshots | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| reconciliation_snapshots | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| reconciliation_snapshots | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| reconciliation_snapshots | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_uploads | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_uploads | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_uploads | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_uploads | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_lines | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_lines | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_lines | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| unreconciled_lines | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_accounts | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_accounts | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_accounts | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_accounts | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_snapshots | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_snapshots | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_snapshots | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| loan_consolidation_snapshots | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_groups | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_groups | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_groups | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_groups | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_group_members | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_group_members | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_group_members | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| consolidation_group_members | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| tier_widget_config | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| tier_widget_config | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| tier_widget_config | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| tier_widget_config | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshots | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshots | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshots | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshots | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshot_runs | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshot_runs | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshot_runs | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| xero_snapshot_runs | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| report_cache | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| report_cache | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| report_cache | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| report_cache | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| scenario_exclusions | read | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| scenario_exclusions | insert | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| scenario_exclusions | update | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| scenario_exclusions | delete | DENY | pglite, live | PK 3 (super_admin alone is not access to client data) |  |
| firms | read | ALLOW | pglite, live | PK 2 path C; Spec §3 (organisation list) |  |
| firm_members | read | ALLOW | pglite, live | PK 2 path C; Spec §3 | Owner-approved Path C item (11 Sep 2026): the membership list is platform metadata, no financial data. |
| firms | update | DENY | pglite, live | PK 3; Spec §4 (ownership only via transfer_organisation_ownership; is_always_free only on the practice organisation, with a reason and an audit row) |  |
| firms | insert | DENY | pglite, live | Spec §4 (creation and membership go through their own functions) |  |
| firms | delete | DENY | pglite, live | Spec §4 (creation and membership go through their own functions) |  |
| firm_members | insert | DENY | pglite, live | Spec §4 (creation and membership go through their own functions) |  |
| firm_members | delete | DENY | pglite, live | Spec §4 (creation and membership go through their own functions) |  |
| client_subscriptions | read | ALLOW | pglite, live | PK 2 path C; Spec §8 (billing metadata, not Xero financial data) |  |
| client_subscriptions | insert | DENY | pglite, live | Spec §8 (a comp needs a reason and an audit row; a direct REST write carries neither) | Phase 3b closed backlog 28: the FOR ALL super-admin policy is dropped, authenticated holds SELECT only, and comps/trials/tier changes go through the audited aal2 functions set_client_comp, set_client_trial and set_client_dashboard_tier. Trigger audit_change records every row change. |
| client_subscriptions | update | DENY | pglite, live | Spec §8 (a comp needs a reason and an audit row; a direct REST write carries neither) | Phase 3b closed backlog 28: the FOR ALL super-admin policy is dropped, authenticated holds SELECT only, and comps/trials/tier changes go through the audited aal2 functions set_client_comp, set_client_trial and set_client_dashboard_tier. Trigger audit_change records every row change. |
| client_subscriptions | delete | DENY | pglite, live | Spec §8 (a comp needs a reason and an audit row; a direct REST write carries neither) | Phase 3b closed backlog 28: the FOR ALL super-admin policy is dropped, authenticated holds SELECT only, and comps/trials/tier changes go through the audited aal2 functions set_client_comp, set_client_trial and set_client_dashboard_tier. Trigger audit_change records every row change. |
| firm_support_access (revoked grant used for a read) | read | DENY | pglite, live | Spec §7 (revoked_at) |  |

## Organisation owner (own organisation)

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| firms | update | DENY | pglite, live | Spec §4; no UPDATE grant for authenticated — organisation name, logo and default cards are changed by server code, never by a direct REST write |  |
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
| report_cache | read | ALLOW | pglite, live | own cache rows |  |
| report_cache | insert | ALLOW | pglite, live | own cache rows |  |
| report_cache | update | ALLOW | pglite, live | own cache rows |  |
| report_cache | delete | ALLOW | pglite, live | own cache rows |  |
| scenario_exclusions | read | DENY | pglite, live | Spec §6 (client_access-scoped table) |  |
| scenario_exclusions | insert | DENY | pglite, live | Spec §6 (client_access-scoped table) |  |
| scenario_exclusions | update | DENY | pglite, live | Spec §6 (client_access-scoped table) |  |
| scenario_exclusions | delete | DENY | pglite, live | Spec §6 (client_access-scoped table) |  |
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
| clients | insert | ALLOW | pglite, live | Spec §6 (is_firm_owner) |  |
| clients | update | ALLOW | pglite, live | Spec §6 (is_firm_owner) |  |
| clients | delete | ALLOW | pglite, live | Spec §6 (is_firm_owner) |  |
| client_reports | insert | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| client_reports | update | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| client_reports | delete | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| reconciliation_snapshots | insert | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| reconciliation_snapshots | update | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| reconciliation_snapshots | delete | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| xero_snapshots | insert | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| xero_snapshots | update | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| xero_snapshots | delete | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| xero_snapshot_runs | insert | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| xero_snapshot_runs | update | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| xero_snapshot_runs | delete | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| client_subscriptions | insert | DENY | pglite, live | Spec §8 (billing is platform-owned) |  |
| client_subscriptions | update | DENY | pglite, live | Spec §8 (billing is platform-owned) |  |
| client_subscriptions | delete | DENY | pglite, live | Spec §8 (billing is platform-owned) |  |
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
| audit_log | read | DENY | pglite, live | Backlog 26 — Spec §3 promises the organisation its own audit rows; only super_admin can read today | Fails closed, so it is a gap rather than an incident. Recorded, not fixed in Phase 2. |
| public.user_can_disconnect_xero_connection() | execute | ALLOW | live | Path A — membership, own organisation |  |
| public.client_xero_files_used() | execute | ALLOW | live | Path A — membership; disconnected files do not consume the allowance | Phase 5: shared with the client allowance triggers, so a disconnected Xero file keeps its client link without counting toward the plan limit. |
| public.xero_connections (tenant over the plan's Xero file limit) | insert | DENY | live | Plan limit trigger PLAN_LIMIT_XERO_ORGS — refused and reported, never stored unassigned | Phase 5 step 5: the callback presents the database's own plan-limit wording and names the refused Xero file. |
| server fn: list clients for an organisation | execute | ALLOW | live | PK 2 path A |  |
| server fn: write client data | execute | ALLOW | live | PK 2 path A |  |
| server fn: invite a member | execute | ALLOW | live | PK 2 path A |  |
| server fn: list pending member invitations | execute | DENY | live | PK section 2 path C — invitations stay platform metadata; inviting is super admin only | public.firm_member_invites requires aal2 + super admin; the People section hides the forms for everyone else. |

## Organisation staff (own organisation)

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| firms | update | DENY | pglite, live | Spec §4; no UPDATE grant for authenticated — organisation name, logo and default cards are changed by server code, never by a direct REST write |  |
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
| report_cache | read | DENY | pglite, live | another member's cache rows |  |
| report_cache | insert | DENY | pglite, live | another member's cache rows |  |
| report_cache | update | DENY | pglite, live | another member's cache rows |  |
| report_cache | delete | DENY | pglite, live | another member's cache rows |  |
| scenario_exclusions | read | DENY | pglite, live | Spec §6 (client_access-scoped table) |  |
| scenario_exclusions | insert | DENY | pglite, live | Spec §6 (client_access-scoped table) |  |
| scenario_exclusions | update | DENY | pglite, live | Spec §6 (client_access-scoped table) |  |
| scenario_exclusions | delete | DENY | pglite, live | Spec §6 (client_access-scoped table) |  |
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
| clients | insert | DENY | pglite, live | Spec §6 (is_firm_owner only) |  |
| clients | update | DENY | pglite, live | Spec §6 (is_firm_owner only) |  |
| clients | delete | DENY | pglite, live | Spec §6 (is_firm_owner only) |  |
| client_reports | insert | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| client_reports | update | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| client_reports | delete | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| reconciliation_snapshots | insert | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| reconciliation_snapshots | update | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| reconciliation_snapshots | delete | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| xero_snapshots | insert | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| xero_snapshots | update | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| xero_snapshots | delete | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| xero_snapshot_runs | insert | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| xero_snapshot_runs | update | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| xero_snapshot_runs | delete | DENY | pglite, live | Spec §6 (written by definer functions / service_role only) |  |
| client_subscriptions | insert | DENY | pglite, live | Spec §8 (billing is platform-owned) |  |
| client_subscriptions | update | DENY | pglite, live | Spec §8 (billing is platform-owned) |  |
| client_subscriptions | delete | DENY | pglite, live | Spec §8 (billing is platform-owned) |  |
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
| user_presence (own row, forged last_seen_at) | update | DENY | live | Phase 1b correction: set_presence_seen_at() trigger overwrites | Denied in effect: the write succeeds but the forged value never persists. Live-only — the PGlite fixture mirrors policies and grants, not triggers. |
| public.online_users() | execute | DENY | pglite, live | PK 2 path C; super admin + aal2 only |  |
| server fn: requestSupportAccess (own pending request) | insert | ALLOW | live | Spec §7 |  |
| server fn: approveSupportAccess | update | DENY | live | Spec §7 (only is_org_owner may approve) |  |
| public.transfer_organisation_ownership() | execute | DENY | pglite, live | Spec §4 (current owner only) |  |
| public.set_profile_display_name_admin() | execute | DENY | pglite, live | PK 2 path C; super admin only |  |
| public.security_posture() | execute | DENY | pglite, live | PK 2 path C; super admin only |  |

## Client viewer (client_access on one client)

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| firms | update | DENY | pglite, live | Spec §4; no UPDATE grant for authenticated — organisation name, logo and default cards are changed by server code, never by a direct REST write |  |
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
| public.user_can_disconnect_xero_connection() | execute | DENY | live | PK 2 (aal2), PK 5 (support grants are read-only), PK 3, PK 4 | Phase 5: disconnecting a Xero file is a write. Membership or client-write only; the connection's firm and client are resolved server-side from the connection id. |

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
| report_cache | read | DENY | pglite, live | Backlog 25 (remainder) — the read policy does not name the support path; fails closed |  |
| scenario_exclusions | read | DENY | pglite, live | Backlog 25 (remainder) — the read policy does not name the support path; fails closed |  |
| clients | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| clients | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| clients | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_xero_orgs | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_xero_orgs | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_xero_orgs | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_notes | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_notes | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_notes | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_access | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_access | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_access | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_cost_classifications | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_cost_classifications | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_cost_classifications | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_true_breakeven_inputs | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_true_breakeven_inputs | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_true_breakeven_inputs | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_statutory_accounts | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_statutory_accounts | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_statutory_accounts | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_reports | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_reports | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_reports | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| reconciliation_snapshots | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| reconciliation_snapshots | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| reconciliation_snapshots | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| unreconciled_uploads | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| unreconciled_uploads | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| unreconciled_uploads | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| unreconciled_lines | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| unreconciled_lines | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| unreconciled_lines | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| loan_consolidation_accounts | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| loan_consolidation_accounts | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| loan_consolidation_accounts | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| loan_consolidation_snapshots | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| loan_consolidation_snapshots | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| loan_consolidation_snapshots | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| consolidation_groups | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| consolidation_groups | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| consolidation_groups | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| consolidation_group_members | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| consolidation_group_members | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| consolidation_group_members | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| tier_widget_config | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| tier_widget_config | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| tier_widget_config | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| xero_snapshots | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| xero_snapshots | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| xero_snapshots | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| xero_snapshot_runs | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| xero_snapshot_runs | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| xero_snapshot_runs | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| report_cache | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| report_cache | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| report_cache | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| scenario_exclusions | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| scenario_exclusions | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| scenario_exclusions | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY) | Proved at the RLS layer: the nine former FOR ALL policies are per-command with membership-only EXISTS checks. Phase 3a closed the rest of backlog 18: app_private.user_can_write_client (membership or client ownership, never a support grant) is now the write helper, app_private.move_xero_file_to_client uses it, and every server-function write path calls public.user_can_write_firm / user_can_write_client. |
| client_subscriptions | insert | DENY | pglite, live | PK 5 (support grants are READ-ONLY); Spec §8 (a comp needs a reason and an audit row) | Phase 3b closed backlog 28: no write policy or write grant remains for authenticated on client_subscriptions, so a support grantee (super admin or not) cannot write. |
| client_subscriptions | update | DENY | pglite, live | PK 5 (support grants are READ-ONLY); Spec §8 (a comp needs a reason and an audit row) | Phase 3b closed backlog 28: no write policy or write grant remains for authenticated on client_subscriptions, so a support grantee (super admin or not) cannot write. |
| client_subscriptions | delete | DENY | pglite, live | PK 5 (support grants are READ-ONLY); Spec §8 (a comp needs a reason and an audit row) | Phase 3b closed backlog 28: no write policy or write grant remains for authenticated on client_subscriptions, so a support grantee (super admin or not) cannot write. |
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
| public.user_can_disconnect_xero_connection() | execute | DENY | live | PK 2 (aal2), PK 5 (support grants are read-only), PK 3, PK 4 | Phase 5: disconnecting a Xero file is a write. Membership or client-write only; the connection's firm and client are resolved server-side from the connection id. |
| server fn: write client data | execute | DENY | live | PK 5 (support grants are READ-ONLY) | Phase 3a: every server-function write path (branding, report finalise/send/revoke/delete, draft save, Xero audit runs and finding snoozes, organisation reconnect-all, loan-consolidation account setup, note report-flagging, Xero file link/unlink/move) authorises through public.user_can_write_firm / public.user_can_write_client, which never admit a support grant. |
| server fn: change organisation or client branding | execute | DENY | live | PK 5 (support grants are READ-ONLY) | branding.server.ts write gates call public.user_can_write_firm / user_can_write_client; reads still allow a grant. |

## Super admin approving their own support grant

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| server fn: approveSupportAccess (own request) | update | DENY | pglite, live | PK 2 path B; Spec §7 (a super admin never approves their own access) |  |

## undefined

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| public.xero_connections (firm_id null) | insert | DENY | live | PK 4 — a Xero connection cannot exist without an organisation (firm_id NOT NULL) | Phase 5 step 5: the connect callback refuses a tenant it cannot place instead of storing it unassigned; the database refuses it as well. |
| public.client_xero_orgs (client in another organisation) | insert | DENY | live | PK 4 — a Xero file must belong to the same organisation as the client it is linked to | Phase 5 step 5: deferred constraint triggers on client_xero_orgs and xero_connections.firm_id. |
