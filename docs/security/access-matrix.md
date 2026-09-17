# Access matrix

> GENERATED FILE — do not edit. Source of truth: `docs/security/access-matrix.ts`.
> Regenerate with `bun run scripts/render-access-matrix.ts`.

Rows: **1637**. Known failures: **0**.

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
| set_client_access_relationship() for own organisation | execute | DENY | pglite, live | PK 1, 3, 4, 5 and paths D/E — no self-classification or status-only bypass |  |
| xero_connections.access_token_enc | read | DENY | pglite, live | PK 8; Spec §10 (no column grant; privilege check precedes RLS) |  |
| xero_connections.refresh_token_enc | read | DENY | pglite, live | PK 8; Spec §10 (no column grant; privilege check precedes RLS) |  |
| xero_connections (non-token columns) | read | DENY | pglite, live | PK 3, PK 4 |  |
| profiles | read | DENY | pglite, live | PK 1 |  |
| user_presence | read | DENY | pglite, live | Phase 1b follow-up (anon holds no privilege) |  |
| server fn: accept an owner invite while the organisation already has an owner | execute | DENY | live | Spec §4 — accepting an invite never replaces a sitting owner | acceptInvite sets firms.owner_user_id only while it is null (the organisation-creation flow) and writes an audit row when it does; otherwise the person joins as a member and ownership is untouched. |
| audit trail row for a public report link view | insert | ALLOW | live | PK 8 — a link view is a read and is recorded; PK 8 — never the token, IP or user agent | client_report_read with anonymous = true, the report and client, and the period; the token itself is never stored, only its SHA-256 hash on the recipient row. |
| firm_viewer_access | read | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | insert | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | update | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | delete | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| viewer management for a client in the caller's own organisation | execute | DENY | pglite, live | Batch 5 — staff read the viewer list only; PK 3, PK 5 admit nothing here |  |
| practice_team | read | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | insert | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | update | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | delete | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| manage the practice team (admin_add/remove_practice_member) | execute | DENY | pglite, live | Batch 5 — super-admin-only, unchanged by the advisors-page control |  |
| remove a staff member of the caller's own organisation | execute | DENY | pglite, live | Spec §15 — owner only; PK 5 admits no write from a support grant and PK 3 none from the role alone |  |
| server fn: read a client dashboard | execute | DENY | live | PK 2 (requireAal2); no session reaches a server function |  |
| server fn: list clients for an organisation | execute | DENY | live | PK 1 deny by default — no session, no server function |  |
| server fn: write client data | execute | DENY | live | PK 1 deny by default — no session, no server function |  |
| record a security attestation | execute | DENY | pglite, live | Spec §17 — super admin only; PK 2 requires aal2 and PK 1 admits nothing without it |  |
| security_attestations | read | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | insert | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | update | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | delete | DENY | pglite, live | Spec §17 — readable by super admins only |  |

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
| set_client_access_relationship() for own organisation | execute | DENY | pglite, live | PK 1, 3, 4, 5 and paths D/E — no self-classification or status-only bypass |  |
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
| record_view_as(their own organisation) | execute | DENY | pglite | PK 2 (aal2 required before anything else) |  |
| set_org_trial(their own organisation) | execute | DENY | pglite | PK 2 (aal2 required before anything else) |  |
| set_org_card_defaults(an organisation) | execute | DENY | pglite | PK 2 (aal2 required before anything else) |  |
| apply_org_card_defaults(an organisation) | execute | DENY | pglite | PK 2 (aal2 required before anything else) |  |
| server fn: list clients for an organisation | execute | DENY | live | PK 2 (requireAal2) |  |
| server fn: read Xero data for a client | execute | DENY | live | PK 2 (requireAal2) |  |
| server fn: write client data | execute | DENY | live | PK 2 (requireAal2) |  |
| server fn: invite a member | execute | DENY | live | PK 2 (requireAal2) |  |
| server fn: transfer ownership | execute | DENY | live | PK 2 (requireAal2) |  |
| server fn: set a report's personal video | execute | DENY | live | PK 2 (requireAal2) + platform super admin only (assert_super_admin) |  |
| firm_viewer_access | read | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | insert | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | update | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | delete | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| viewer management for a client in the caller's own organisation | execute | DENY | pglite, live | Batch 5 — staff read the viewer list only; PK 3, PK 5 admit nothing here |  |
| practice_team | read | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | insert | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | update | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | delete | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| manage the practice team (admin_add/remove_practice_member) | execute | DENY | pglite, live | Batch 5 — super-admin-only, unchanged by the advisors-page control |  |
| remove a staff member of the caller's own organisation | execute | DENY | pglite, live | Spec §15 — owner only; PK 5 admits no write from a support grant and PK 3 none from the role alone |  |
| server fn: read a client dashboard | execute | DENY | live | PK 2 (requireAal2); no session reaches a server function |  |
| record a security attestation | execute | DENY | pglite, live | Spec §17 — super admin only; PK 2 requires aal2 and PK 1 admits nothing without it |  |
| security_attestations | read | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | insert | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | update | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | delete | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| server fn: getClientOrgTrial | execute | DENY | live | PK 2 — MFA is enforced on the server | app_private.assert_aal2() runs before anything is read, so an aal1 session is refused with MFA_REQUIRED even when the person would otherwise qualify. |

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
| set_client_access_relationship() for own organisation | execute | DENY | pglite, live | PK 1, 3, 4, 5 and paths D/E — no self-classification or status-only bypass |  |
| xero_connections (non-token columns) | read | DENY | pglite, live | PK 3, PK 4 |  |
| plan_levels | insert | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| plan_levels | update | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| plan_levels | delete | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| tier_settings | insert | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| tier_settings | update | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| tier_settings | delete | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| public.user_can_disconnect_xero_connection() | execute | DENY | live | PK 2 (aal2), PK 5 (support grants are read-only), PK 3, PK 4 | Phase 5: disconnecting a Xero file is a write. Membership or client-write only; the connection's firm and client are resolved server-side from the connection id. |
| public.client_xero_files_used() | execute | DENY | live | PK 2 (aal2), PK 3, PK 4 |  |
| set_org_card_defaults(an organisation) | execute | DENY | pglite | app_private.assert_firm_member_write: active membership of this organisation only, deliberately not has_firm_access (which admits read-only support grants) |  |
| apply_org_card_defaults(an organisation) | execute | DENY | pglite | app_private.assert_firm_member_write: active membership of this organisation only, deliberately not has_firm_access (which admits read-only support grants) |  |
| server fn: list clients for an organisation | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: read Xero data for a client | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: write client data | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: invite a member | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: transfer ownership | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| audit trail row for reading another organisation's client figures | insert | DENY | live | PK 1 / PK 4 — the read is impossible, so nothing is recorded | Access is refused before any read path runs; no audit row is written because no read happened. |
| firm_viewer_access | read | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | insert | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | update | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | delete | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| viewer management for a client in the caller's own organisation | execute | DENY | pglite, live | Batch 5 — staff read the viewer list only; PK 3, PK 5 admit nothing here |  |
| practice_team | read | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | insert | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | update | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | delete | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| manage the practice team (admin_add/remove_practice_member) | execute | DENY | pglite, live | Batch 5 — super-admin-only, unchanged by the advisors-page control |  |
| remove a staff member of the caller's own organisation | execute | DENY | pglite, live | Spec §15 — owner only; PK 5 admits no write from a support grant and PK 3 none from the role alone |  |
| record a security attestation | execute | DENY | pglite, live | Spec §17 — super admin only; PK 2 requires aal2 and PK 1 admits nothing without it |  |
| security_attestations | read | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | insert | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | update | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | delete | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| user_can_write_client_scenario() for a client outside their organisation | execute | DENY | pglite | PK 1 / PK 4 — membership in another organisation writes nothing here |  |

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
| remove a staff member of the caller's own organisation | execute | DENY | pglite, live | Spec §15 — owner only; PK 5 admits no write from a support grant and PK 3 none from the role alone |  |

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
| remove a staff member of the caller's own organisation | execute | DENY | pglite, live | Spec §15 — owner only; PK 5 admits no write from a support grant and PK 3 none from the role alone |  |
| the organisation's clients after removal | read | DENY | pglite, live | PK 2 path A — membership must be ACTIVE |  |

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
| set_client_access_relationship() for own organisation | execute | DENY | pglite, live | PK 1, 3, 4, 5 and paths D/E — no self-classification or status-only bypass |  |
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
| xero_rate_limits | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_rate_limits | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_rate_limits | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| admin_firm_overview | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| plan_levels | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| tier_settings | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| signup_requests | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| access_invites | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| user_roles | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| audit_log | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| xero_api_errors | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
| xero_rate_limits | read | ALLOW | pglite, live | PK 2 path C (metadata only, never Xero financial data) |  |
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
| record_view_as(an organisation they are not a member of) | execute | DENY | pglite | PK 3 — super_admin alone grants no organisation access, so it cannot preview one either | Added 16 Sep 2026 with the audited View as action on the Organisations table. Before this, view-as was a URL parameter with no audit row and no database check. |
| xero_error_breakdown() | execute | ALLOW | pglite | PK 2 path C — Xero telemetry is platform metadata: status codes and endpoints, never client data |  |
| set_org_trial(any organisation) | execute | ALLOW | pglite | PK 2 path C — plan and billing metadata is platform operations; no client data is read or returned | Added 16 Sep 2026 when trials moved from the client to the organisation. |
| starting a trial over purchased Advisory converts the purchase and keeps ticks | execute | ALLOW | pglite | The audited trial change is atomic: selected purchased options become trialled while client card selections remain untouched | Added 16 Sep 2026 after a purchase-plus-trial overlap could create a cosmetic trial that granted nothing. |
| toggling Consolidation off and on preserves all consolidation working data | execute | ALLOW | pglite | Availability is an entitlement filter, never a data operation — switching an option off hides cards and deletes nothing | Added 16 Sep 2026 at the owner's direction — her single biggest concern about this model. Proves, on every check, that set_org_purchase with Consolidation false leaves consolidation_groups, consolidation_group_members, loan_consolidation_accounts and loan_consolidation_snapshots row-for-row unchanged, that the loan_consolidation card stops being available while it is off, and that switching it back on restores the card with the working data and the per-client ticks intact. No foreign key or trigger on those four tables references the option: their only cascades are from deleting a firm, client or group. |
| server fn: list clients for an organisation | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: read Xero data for a client | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: write client data | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: invite a member | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: transfer ownership | execute | DENY | live | PK 4 (caller-supplied id is a filter, never a grant); PK 3 |  |
| server fn: set a report's personal video | execute | DENY | live | PK 3 (super admin alone grants ZERO client data) + PK 5 | setReportVideo runs assert_super_admin AND canWriteFirm (public.user_can_write_firm) on the report's own firm_id, read server-side from the stored row. A super admin who is not an active member of that organisation is refused. Finalised or sent reports are refused outright; the video never enters the payload, so it cannot reach the rendered PDF. |
| server fn: invite an owner to an existing organisation | execute | DENY | live | Spec §4 — ownership only moves through transfer_organisation_ownership | adminInviteFirmMember accepts role 'staff' only; an owner invitation to an existing organisation is refused with a pointer to ownership transfer. |
| firm_viewer_access | read | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | insert | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | update | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | delete | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| viewer management for a client in the caller's own organisation | execute | DENY | pglite, live | Batch 5 — staff read the viewer list only; PK 3, PK 5 admit nothing here |  |
| practice_team | read | ALLOW | pglite, live | PK 2 path C — platform metadata, no client data |  |
| practice_team | insert | DENY | pglite, live | Batch 5 — writes only through the audited admin_add/remove_practice_member definer functions |  |
| practice_team | update | DENY | pglite, live | Batch 5 — writes only through the audited admin_add/remove_practice_member definer functions |  |
| practice_team | delete | DENY | pglite, live | Batch 5 — writes only through the audited admin_add/remove_practice_member definer functions |  |
| manage the practice team (admin_add/remove_practice_member) | execute | ALLOW | pglite, live | PK 2 path C — platform metadata; aal2 + super admin asserted in the definer function |  |
| remove a staff member of the caller's own organisation | execute | DENY | pglite, live | Spec §15 — owner only; PK 5 admits no write from a support grant and PK 3 none from the role alone |  |
| record a security attestation | execute | ALLOW | pglite, live | Spec §17 — attestations are platform metadata, super admin only |  |
| a security attestation's confirmed_by and confirmed_at are set by the server | execute | ALLOW | pglite, live | Spec §17 — the function stamps auth.uid() and now(); no caller-supplied identity or time |  |
| security_attestations | read | ALLOW | pglite, live | PK 2 path C — platform metadata, no client data |  |
| security_attestations | insert | DENY | pglite, live | Spec §17 — writes only through public.record_security_attestation; no write policy exists at all |  |
| security_attestations | update | DENY | pglite, live | Spec §17 — writes only through public.record_security_attestation; no write policy exists at all |  |
| security_attestations | delete | DENY | pglite, live | Spec §17 — writes only through public.record_security_attestation; no write policy exists at all |  |
| admin_assert_can_sign_out_user(another person) | execute | ALLOW | pglite | Path C — platform operations; aal2 + super admin, audited, no client data |  |
| admin_assert_can_sign_out_user(their own account) | execute | DENY | pglite | PK 1 — the caller uses Sign out my other devices for themselves |  |

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
| firms | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| firm_members | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| clients | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| client_xero_orgs | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| client_notes | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| client_access | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| client_cost_classifications | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| client_true_breakeven_inputs | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| client_statutory_accounts | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| client_subscriptions | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| client_reports | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| reconciliation_snapshots | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| unreconciled_uploads | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| unreconciled_lines | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| loan_consolidation_accounts | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| loan_consolidation_snapshots | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| consolidation_groups | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| consolidation_group_members | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| tier_widget_config | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| xero_snapshots | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| xero_snapshot_runs | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| scenario_exclusions | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| report_cache | read | ALLOW | pglite, live | own cache rows |  |
| report_cache | insert | ALLOW | pglite, live | own cache rows |  |
| report_cache | update | ALLOW | pglite, live | own cache rows |  |
| report_cache | delete | ALLOW | pglite, live | own cache rows |  |
| client_xero_orgs | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_xero_orgs | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_xero_orgs | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_notes | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_notes | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_notes | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
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
| scenario_exclusions | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| scenario_exclusions | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| scenario_exclusions | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_access | insert | DENY | pglite, live | PK rule 11; Spec §14.3 — client_access writes use audited functions only |  |
| client_access | update | DENY | pglite, live | PK rule 11; Spec §14.3 — client_access writes use audited functions only |  |
| client_access | delete | DENY | pglite, live | PK rule 11; Spec §14.3 — client_access writes use audited functions only |  |
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
| set_client_access_relationship() for own organisation | execute | ALLOW | pglite, live | PK paths D/E — owner classifies selected-client access through an audited function |  |
| two Business owners on one client remain independently client-scoped | execute | ALLOW | pglite, live | PK path E — several Business owners are valid; each exact client_access row stands alone |  |
| removing membership preserves the Business owner relationship row | execute | ALLOW | pglite, live | PK path E — membership removal does not silently delete independently granted client access |  |
| inviter labels do not affect identity or authorisation | execute | ALLOW | pglite, live | PK rule 11; Spec §14.3 — labels are display-only |  |
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
| xero_rate_limits | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_rate_limits | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_rate_limits | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| audit_log | read | DENY | pglite, live | Backlog 26 — Spec §3 promises the organisation its own audit rows; only super_admin can read today | Fails closed, so it is a gap rather than an incident. Recorded, not fixed in Phase 2. |
| public.user_can_disconnect_xero_connection() | execute | ALLOW | live | Path A — membership, own organisation |  |
| public.client_xero_files_used() | execute | ALLOW | live | Path A — membership; disconnected files do not consume the allowance | Phase 5: shared with the client allowance triggers, so a disconnected Xero file keeps its client link without counting toward the plan limit. |
| public.xero_connections (disconnecting leaves no token ciphertext) | update | ALLOW | live | Backlog 38 — a revoked grant leaves no token at rest | Phase 7: every path that marks a connection disconnected because the grant is dead (advisor disconnect, grant_revoked on refresh, unassigned cleanup) nulls access_token_enc and refresh_token_enc in the same update. The authorisation reconcile (not_authorised) deliberately keeps the ciphertext, because that token is still valid for the other tenants on the same consent and the row can be restored without re-authorising. |
| public.xero_connections (firm_id null) | insert | DENY | live | PK 4 — a Xero connection cannot exist without an organisation (firm_id NOT NULL) | Phase 5 step 5: the connect callback refuses a tenant it cannot place instead of storing it unassigned; the database refuses it as well. |
| public.client_xero_orgs (client in another organisation) | insert | DENY | live | PK 4 — a Xero file must belong to the same organisation as the client it is linked to | Phase 5 step 5: deferred constraint triggers on client_xero_orgs and xero_connections.firm_id. |
| public.xero_connections (tenant over the plan's Xero file limit) | insert | DENY | live | Plan limit trigger PLAN_LIMIT_XERO_ORGS — refused and reported, never stored unassigned | Phase 5 step 5: the callback presents the database's own plan-limit wording and names the refused Xero file. |
| record_view_as(their own organisation) | execute | DENY | pglite | Platform operations only (assert_super_admin) — an organisation owner has no impersonation action |  |
| xero_error_breakdown() | execute | DENY | pglite | PK 2 path C is platform operations only; an organisation reads its own Xero errors elsewhere |  |
| set_org_trial(their own organisation) | execute | DENY | pglite | Commercial change — assert_super_admin, same treatment as a comp; an organisation cannot grant itself a trial |  |
| purchased Advisory keeps its cards with no trial or an expired trial | read | ALLOW | pglite | Effective options = purchased OR unexpired trial — an absent or expired trial can never take away a purchase | Added 16 Sep 2026 at the owner's direction: this is the case that protects an organisation whose Advisory is granted rather than trialled. |
| trial-only organisation options are available and identified as trialled | read | ALLOW | pglite | Every organisation-option display uses effective state (purchased OR unexpired trial), while preserving the trial marker and end date | Added 17 Sep 2026 after the Organisations row incorrectly described a genuine Advisory and Consolidation trial as both options being off. |
| an expired trial with nothing purchased shows no Advisory cards, and the ticks survive | read | DENY | pglite | A trial ends at read time with no scheduled job; per-client ticked lists are never rewritten |  |
| a new client starts from the organisation's default card set | read | ALLOW | pglite | The default is a template copied into the new client's own ticked list in the transaction that creates it — never a resolution layer | Added 17 Sep 2026 with organisation card defaults. Proves the AFTER INSERT trigger app_private.seed_client_cards_from_org_default writes the template into public.client_cards for the new client, and that with no template saved the new client gets no row at all, which still means every available card, exactly as before. |
| changing the default card set does not change an existing client | read | ALLOW | pglite | Resolution is the purchase intersected with the one ticked list stored for that client; the default is not read | Added 17 Sep 2026. The design constraint the owner set: if the default were consulted when resolving a dashboard, the multi-layer model would be back. Proves an existing client's visible cards are byte-identical before and after set_org_card_defaults, and only change when apply_org_card_defaults is deliberately run. |
| an organisation created with Advisory off cannot reach Advisory cards by any route | read | DENY | pglite | Resolution is the purchase intersected with the client's ticked list; a tick for a card the organisation has not bought grants nothing | Added 17 Sep 2026 with the creation flow. Creation captures the purchase through set_org_purchase, so an organisation created with Advisory off has no Advisory cards available and none visible, even with an Advisory key sitting in the client's ticked list. |
| an organisation created with Advisory on and cards unticked has those cards available but off | read | ALLOW | pglite | Card preferences are not a purchase: unticking a card leaves it bought and available, simply not shown | Added 17 Sep 2026 with the creation flow. Proves the unticked Advisory cards stay in client_available_cards (so they can be turned back on) while being absent from the resolved dashboard. |
| set_org_card_defaults(an organisation) | execute | ALLOW | pglite | PK 2 path A — the organisation's own owner sets its template and may overwrite its own clients' ticks, audited |  |
| apply_org_card_defaults(an organisation) | execute | ALLOW | pglite | PK 2 path A — the organisation's own owner sets its template and may overwrite its own clients' ticks, audited |  |
| server fn: list clients for an organisation | execute | ALLOW | live | PK 2 path A |  |
| server fn: write client data | execute | ALLOW | live | PK 2 path A |  |
| server fn: invite a member | execute | ALLOW | live | PK 2 path A |  |
| server fn: set a report's personal video | execute | DENY | live | PK 2 (requireAal2) + platform super admin only (assert_super_admin) |  |
| server fn: list pending member invitations | execute | DENY | live | PK section 2 path C — invitations stay platform metadata; inviting is super admin only | public.firm_member_invites requires aal2 + super admin; the People section hides the forms for everyone else. |
| PLAN_LIMIT_CLIENTS counts clients, not standing grants | execute | ALLOW | pglite, live | PK section 2 path D — a standing grant never counts toward plan limits |  |
| firm_viewer_access | read | ALLOW | pglite, live | PK section 2 path D — the organisation's owner grants and revokes |  |
| firm_viewer_access | insert | ALLOW | pglite, live | PK section 2 path D — the organisation's owner grants and revokes |  |
| firm_viewer_access | update | ALLOW | pglite, live | PK section 2 path D — the organisation's owner grants and revokes |  |
| firm_viewer_access | delete | ALLOW | pglite, live | PK section 2 path D — the organisation's owner grants and revokes |  |
| viewer management for a client in the caller's own organisation | execute | ALLOW | pglite, live | PK 2 client viewer + path D; Batch 5 owner permission |  |
| viewer management for another organisation's client | execute | DENY | pglite, live | PK 4 — the owner's own organisation only |  |
| practice-team membership of organisation A inside organisation B | execute | DENY | pglite, live | PK 4; Batch 5 — practice team is metadata, an ACTIVE membership of THAT organisation is still required |  |
| practice_team | read | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | insert | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | update | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | delete | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| manage the practice team (admin_add/remove_practice_member) | execute | DENY | pglite, live | Batch 5 — super-admin-only, unchanged by the advisors-page control |  |
| remove a staff member of the caller's own organisation | execute | ALLOW | pglite, live | Spec §15 — the handover case: an owner removes staff of their own organisation |  |
| remove a Traction Advisory (practice-team) staff member | execute | ALLOW | pglite, live | Design decision 8 — our people are removable by the owner after handover |  |
| an owner removes themselves | execute | DENY | pglite, live | Spec §15 — ownership must be transferred first; an organisation is never left without an owner |  |
| removal leaves client viewer and standing grants untouched | execute | ALLOW | pglite, live | Spec §15 — removal is a membership status change and nothing else |  |
| server fn: read a client dashboard | execute | ALLOW | live | PK 2 path A |  |
| server fn: list pending member invitations | execute | DENY | live | PK 2 path C — member invitations are platform metadata, super admin only |  |
| record a security attestation | execute | DENY | pglite, live | Spec §17 — super admin only; PK 2 requires aal2 and PK 1 admits nothing without it |  |
| security_attestations | read | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | insert | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | update | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | delete | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| user_can_write_client_scenario() for a client in their organisation | execute | ALLOW | pglite | PK section 2 path A — membership or client ownership still writes scenario exclusions, unchanged by Batch 3 |  |

## Organisation staff (own organisation)

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| firms | update | DENY | pglite, live | Spec §4; no UPDATE grant for authenticated — organisation name, logo and default cards are changed by server code, never by a direct REST write |  |
| firms | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| firm_members | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| clients | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| client_xero_orgs | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| client_notes | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| client_access | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| client_cost_classifications | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| client_true_breakeven_inputs | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| client_statutory_accounts | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| client_subscriptions | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| client_reports | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| reconciliation_snapshots | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| unreconciled_uploads | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| unreconciled_lines | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| loan_consolidation_accounts | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| loan_consolidation_snapshots | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| consolidation_groups | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| consolidation_group_members | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| tier_widget_config | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| xero_snapshots | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| xero_snapshot_runs | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| scenario_exclusions | read | ALLOW | pglite, live | PK 2 path A; Spec §3 — including scenario_exclusions, which the member SELECT policy added by the Batch 3 regression fix admits |  |
| report_cache | read | DENY | pglite, live | another member's cache rows |  |
| report_cache | insert | DENY | pglite, live | another member's cache rows |  |
| report_cache | update | DENY | pglite, live | another member's cache rows |  |
| report_cache | delete | DENY | pglite, live | another member's cache rows |  |
| client_xero_orgs | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_xero_orgs | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_xero_orgs | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_notes | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_notes | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_notes | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
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
| scenario_exclusions | insert | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| scenario_exclusions | update | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| scenario_exclusions | delete | ALLOW | pglite, live | PK 2 path A; Spec §6 |  |
| client_access | insert | DENY | pglite, live | PK rule 11; Spec §14.3 — client_access writes use audited functions only |  |
| client_access | update | DENY | pglite, live | PK rule 11; Spec §14.3 — client_access writes use audited functions only |  |
| client_access | delete | DENY | pglite, live | PK rule 11; Spec §14.3 — client_access writes use audited functions only |  |
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
| set_client_access_relationship() for own organisation | execute | DENY | pglite, live | PK 1, 3, 4, 5 and paths D/E — no self-classification or status-only bypass |  |
| membership governs a simultaneous Business owner relationship | execute | ALLOW | pglite, live | PK paths A/E — active membership is broader and does not conflict with the relationship row |  |
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
| xero_rate_limits | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_rate_limits | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_rate_limits | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
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
| server fn: set a report's personal video | execute | DENY | live | PK 2 (requireAal2) + platform super admin only (assert_super_admin) |  |
| server fn: set a client logo when the organisation has not bought Branding | execute | DENY | live | Spec §5 — Branding is a purchasable option; an entitlement is never a grant | setClientLogo calls public.client_branding_enabled (aal2 + user_can_read_client + effective branding + NOT lapsed) after the write gate. A direct upload call is refused, and getClientLogo returns no path or signed URL, so an existing report link cannot render the logo either. |
| server fn: set a client logo when the organisation has bought Branding | execute | ALLOW | live | Path A — membership writes within its own organisation | With effective branding on (purchased OR unexpired trial that explicitly includes Branding) and the organisation not lapsed, an active member may upload, replace and clear the client logo. Switching Branding off hides the logo; storage and clients.logo_path are untouched, so it returns when Branding comes back. |
| audit trail row for reading a client's figures | insert | ALLOW | live | PK 8 / Spec §1 — reading client financial data must be auditable | Opening a client dashboard writes one xero_data_read row per actor + client + Xero file + read key + source per five minutes, recording no figures, account names or contact names. |
| firm_viewer_access | read | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | insert | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | update | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | delete | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| viewer management for a client in the caller's own organisation | execute | DENY | pglite, live | Batch 5 — staff read the viewer list only; PK 3, PK 5 admit nothing here |  |
| practice_team | read | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | insert | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | update | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | delete | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| manage the practice team (admin_add/remove_practice_member) | execute | DENY | pglite, live | Batch 5 — super-admin-only, unchanged by the advisors-page control |  |
| removing the organisation's last remaining member | execute | DENY | pglite, live | Spec §15 — an organisation is never stranded with no members |  |
| leave the organisation (remove yourself) | execute | ALLOW | pglite, live | Spec §15 — anyone who is not the owner may leave |  |
| remove a staff member of the caller's own organisation | execute | DENY | pglite, live | Spec §15 — owner only; PK 5 admits no write from a support grant and PK 3 none from the role alone |  |
| record a security attestation | execute | DENY | pglite, live | Spec §17 — super admin only; PK 2 requires aal2 and PK 1 admits nothing without it |  |
| security_attestations | read | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | insert | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | update | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | delete | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| user_can_write_client_scenario() for a client in their organisation | execute | ALLOW | pglite | PK section 2 path A — an active member's scenario writes are unchanged by Batch 3 |  |
| touch_session_activity() | execute | ALLOW | pglite | PK 2 — a live aal2 session records its own activity, caller-scoped |  |
| session_activity | update | DENY | pglite | PK 1 — read-only to signed-in users; only the definer function writes |  |
| admin_assert_can_sign_out_user(another person) | execute | DENY | pglite | Invariant 3/6 — only a super admin may sign another person out |  |
| server fn: getClientSetupChecklist for a client in another organisation | execute | DENY | live | PK 4 (a caller-supplied client_id is a FILTER, never a GRANT) | assertClientDataAccessForClient runs first, and every read inside setup-checklist.server.ts goes through context.supabase, so RLS scopes the clients, client_statutory_accounts, client_cost_classifications and xero_snapshots reads. public.client_setup_account_counts is SECURITY INVOKER, so it counts only rows the caller may already read. |
| server fn: getClientOrgTrial for a client in their organisation | execute | ALLOW | live | Path A — members see their own organisation's billing state | app_private.has_firm_access (active membership) admits the caller; the same row a super admin sees on the purchase card is what the banner renders. |

## External adviser — selected clients (client_access on one client; user-facing name only, the key is unchanged)

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
| set_client_access_relationship() for own organisation | execute | DENY | pglite, live | PK 1, 3, 4, 5 and paths D/E — no self-classification or status-only bypass |  |
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
| xero_rate_limits | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_rate_limits | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_rate_limits | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| plan_levels | insert | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| plan_levels | update | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| plan_levels | delete | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| tier_settings | insert | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| tier_settings | update | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| tier_settings | delete | DENY | pglite | Spec §5 (plan catalogue is platform-owned) |  |
| public.user_can_disconnect_xero_connection() | execute | DENY | live | PK 2 (aal2), PK 5 (support grants are read-only), PK 3, PK 4 | Phase 5: disconnecting a Xero file is a write. Membership or client-write only; the connection's firm and client are resolved server-side from the connection id. |
| record_view_as(their own organisation) | execute | DENY | pglite | PK 2 path D — a viewer grant is read-only and never platform operations |  |
| set_org_trial(the organisation of the client they can see) | execute | DENY | pglite | PK 2 path D — an adviser grant is read-only and never organisation or platform data |  |
| set_org_card_defaults(an organisation) | execute | DENY | pglite | app_private.assert_firm_member_write: active membership of this organisation only, deliberately not has_firm_access (which admits read-only support grants) |  |
| apply_org_card_defaults(an organisation) | execute | DENY | pglite | app_private.assert_firm_member_write: active membership of this organisation only, deliberately not has_firm_access (which admits read-only support grants) |  |
| server fn: set a report's personal video | execute | DENY | live | PK 2 (requireAal2) + platform super admin only (assert_super_admin) |  |
| audit trail row for reading a client's figures | insert | ALLOW | live | PK 8 / Spec §1 — every reader is recorded, not only staff | A client viewer's dashboard read writes the same row with their own user id as the actor. |
| clients (client added after the grant) | read | DENY | pglite, live | PK section 2 client viewer — a specific grant covers that client only |  |
| firm_viewer_access | read | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | insert | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | update | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | delete | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| viewer management for a client in the caller's own organisation | execute | DENY | pglite, live | Batch 5 — staff read the viewer list only; PK 3, PK 5 admit nothing here |  |
| practice_team | read | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | insert | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | update | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | delete | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| manage the practice team (admin_add/remove_practice_member) | execute | DENY | pglite, live | Batch 5 — super-admin-only, unchanged by the advisors-page control |  |
| remove a staff member of the caller's own organisation | execute | DENY | pglite, live | Spec §15 — owner only; PK 5 admits no write from a support grant and PK 3 none from the role alone |  |
| record a security attestation | execute | DENY | pglite, live | Spec §17 — super admin only; PK 2 requires aal2 and PK 1 admits nothing without it |  |
| security_attestations | read | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | insert | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | update | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | delete | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| scenario_exclusions | insert | DENY | pglite, live | PK rule 11; PK section 2 path D — an External adviser grant is read-only, including scenario exclusions and reconciliation comments |  |
| scenario_exclusions | update | DENY | pglite, live | PK rule 11; PK section 2 path D — an External adviser grant is read-only, including scenario exclusions and reconciliation comments |  |
| scenario_exclusions | delete | DENY | pglite, live | PK rule 11; PK section 2 path D — an External adviser grant is read-only, including scenario exclusions and reconciliation comments |  |
| unreconciled_lines | insert | DENY | pglite, live | PK rule 11; PK section 2 path D — an External adviser grant is read-only, including scenario exclusions and reconciliation comments |  |
| unreconciled_lines | update | DENY | pglite, live | PK rule 11; PK section 2 path D — an External adviser grant is read-only, including scenario exclusions and reconciliation comments |  |
| unreconciled_lines | delete | DENY | pglite, live | PK rule 11; PK section 2 path D — an External adviser grant is read-only, including scenario exclusions and reconciliation comments |  |
| user_can_write_client_scenario() for the client they can read | execute | DENY | pglite | PK rule 11 — the read predicate is gone from the scenario write check |  |
| server fn: getClientOrgTrial | execute | DENY | live | Path D — an external adviser never sees billing, plan or organisation-level data | A client_access row with relationship = 'external_adviser' (or NULL) does not match the business_owner predicate and the caller is not a member, so no rows are returned. |

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
| set_client_access_relationship() for own organisation | execute | DENY | pglite, live | PK 1, 3, 4, 5 and paths D/E — no self-classification or status-only bypass |  |
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
| xero_rate_limits | insert | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_rate_limits | update | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| xero_rate_limits | delete | DENY | pglite, live | PK 10; Spec §9 (append-only) |  |
| public.user_can_disconnect_xero_connection() | execute | DENY | live | PK 2 (aal2), PK 5 (support grants are read-only), PK 3, PK 4 | Phase 5: disconnecting a Xero file is a write. Membership or client-write only; the connection's firm and client are resolved server-side from the connection id. |
| set_org_trial(the organisation they support) | execute | ALLOW | pglite | PK 2 path C — this person is a platform super admin, so the change is plan metadata; the support grant contributes nothing to it | Support grants are only ever held by a Positive Traction super admin, so this row cannot separate the two paths. What it does prove is that the trial function reads and returns no client data, so invariant 5 (support grants are read-only over CLIENT data) is untouched: org_owner and client_viewer above are refused outright. |
| set_org_card_defaults(an organisation) | execute | DENY | pglite | app_private.assert_firm_member_write: active membership of this organisation only, deliberately not has_firm_access (which admits read-only support grants) |  |
| apply_org_card_defaults(an organisation) | execute | DENY | pglite | app_private.assert_firm_member_write: active membership of this organisation only, deliberately not has_firm_access (which admits read-only support grants) |  |
| server fn: write client data | execute | DENY | live | PK 5 (support grants are READ-ONLY) | Phase 3a: every server-function write path (branding, report finalise/send/revoke/delete, draft save, Xero audit runs and finding snoozes, organisation reconnect-all, loan-consolidation account setup, note report-flagging, Xero file link/unlink/move) authorises through public.user_can_write_firm / public.user_can_write_client, which never admit a support grant. |
| server fn: set a report's personal video | execute | DENY | live | PK 2 (requireAal2) + platform super admin only (assert_super_admin) |  |
| server fn: change organisation or client branding | execute | DENY | live | PK 5 (support grants are READ-ONLY) | branding.server.ts write gates call public.user_can_write_firm / user_can_write_client; reads still allow a grant. The Branding entitlement gate added on top narrows further and never widens: assertClientWriter still runs first. |
| audit trail row for reading a client's figures | insert | ALLOW | live | PK section 2 path B — support reads are read-only AND recorded | meta.access_path comes from public.firm_access_path, so a support read is distinguishable from a member read. |
| firm_viewer_access | read | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | insert | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | update | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| firm_viewer_access | delete | DENY | pglite, live | PK section 2 path D — owner or an active practice-team member of THAT organisation only |  |
| viewer management for a client in the caller's own organisation | execute | DENY | pglite, live | Batch 5 — staff read the viewer list only; PK 3, PK 5 admit nothing here |  |
| practice_team | read | ALLOW | pglite, live | PK 2 path C — reads as a platform admin; no organisation or client data on this table |  |
| practice_team | insert | DENY | pglite, live | Batch 5 — writes only through the audited admin_add/remove_practice_member definer functions |  |
| practice_team | update | DENY | pglite, live | Batch 5 — writes only through the audited admin_add/remove_practice_member definer functions |  |
| practice_team | delete | DENY | pglite, live | Batch 5 — writes only through the audited admin_add/remove_practice_member definer functions |  |
| manage the practice team (admin_add/remove_practice_member) | execute | ALLOW | pglite, live | PK 2 path C — platform metadata; aal2 + super admin asserted in the definer function |  |
| remove a staff member of the caller's own organisation | execute | DENY | pglite, live | Spec §15 — owner only; PK 5 admits no write from a support grant and PK 3 none from the role alone |  |
| record a security attestation | execute | ALLOW | pglite, live | Spec §17 — acts as a platform admin (this fixture identity also holds super_admin); PK 5 is untouched, no organisation or client data is reachable here | The support-grant subject in the fixture also holds the super_admin role, so this row proves the Path C rule, not a support-grant widening. |
| security_attestations | read | ALLOW | pglite, live | PK 2 path C — reads as a platform admin; no organisation or client data on this table |  |
| security_attestations | insert | DENY | pglite, live | Spec §17 — writes only through public.record_security_attestation; no write policy exists at all |  |
| security_attestations | update | DENY | pglite, live | Spec §17 — writes only through public.record_security_attestation; no write policy exists at all |  |
| security_attestations | delete | DENY | pglite, live | Spec §17 — writes only through public.record_security_attestation; no write policy exists at all |  |
| server fn: acknowledgeSetupItem (record a setup decision) | execute | DENY | live | PK 5 (support grants are READ-ONLY) | The acknowledgement is an UPDATE on public.clients through context.supabase, so the clients write policies (app_private.user_can_manage_client) decide. A support grant is read-only, so the update matches no row and the function raises 'You cannot change this client.' Reading the checklist stays allowed, like other client reads under a grant. |
| server fn: getClientOrgTrial | execute | DENY | live | PK 5 / Path B — a support grant is read-only client data, never billing state | app_private.has_firm_access counts active firm_members rows only, so a support grant does not satisfy it; without a business_owner row the function returns nothing. |

## External adviser — All clients (firm_viewer_access on one organisation, read-only; user-facing name only, the key is unchanged)

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| set_client_access_relationship() for own organisation | execute | DENY | pglite, live | PK 1, 3, 4, 5 and paths D/E — no self-classification or status-only bypass |  |
| clients | read | ALLOW | pglite, live | PK section 2 path D — read every client in the organisation |  |
| client_notes | read | ALLOW | pglite, live | PK section 2 path D — read every client in the organisation |  |
| client_cost_classifications | read | ALLOW | pglite, live | PK section 2 path D — read every client in the organisation |  |
| client_statutory_accounts | read | ALLOW | pglite, live | PK section 2 path D — read every client in the organisation |  |
| client_true_breakeven_inputs | read | ALLOW | pglite, live | PK section 2 path D — read every client in the organisation |  |
| client_xero_orgs | read | ALLOW | pglite, live | PK section 2 path D — read every client in the organisation |  |
| unreconciled_lines | read | ALLOW | pglite, live | PK section 2 path D — read every client in the organisation |  |
| unreconciled_uploads | read | ALLOW | pglite, live | PK section 2 path D — read every client in the organisation |  |
| clients (client added after the grant) | read | ALLOW | pglite, live | PK section 2 path D — standing, not a snapshot |  |
| clients (another organisation's client) | read | DENY | pglite, live | PK section 2 path D — never crosses organisations |  |
| clients | insert | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| clients | update | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| clients | delete | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_access | insert | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_access | update | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_access | delete | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_notes | insert | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_notes | update | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_notes | delete | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_cost_classifications | insert | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_cost_classifications | update | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_cost_classifications | delete | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_statutory_accounts | insert | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_statutory_accounts | update | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_statutory_accounts | delete | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_true_breakeven_inputs | insert | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_true_breakeven_inputs | update | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_true_breakeven_inputs | delete | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_xero_orgs | insert | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_xero_orgs | update | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| client_xero_orgs | delete | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| unreconciled_lines | insert | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| unreconciled_lines | update | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| unreconciled_lines | delete | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| unreconciled_uploads | insert | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| unreconciled_uploads | update | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| unreconciled_uploads | delete | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| scenario_exclusions | insert | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| scenario_exclusions | update | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| scenario_exclusions | delete | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| firm_viewer_access | insert | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| firm_viewer_access | update | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| firm_viewer_access | delete | DENY | pglite, live | PK section 2 path D — a standing grant confers no write, anywhere; the standing predicate appears only in read paths |  |
| firms | read | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| firms | insert | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| firms | update | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| firms | delete | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| firm_members | read | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| firm_members | insert | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| firm_members | update | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| firm_members | delete | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| audit_log | read | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| audit_log | insert | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| audit_log | update | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| audit_log | delete | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| subscriptions | read | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| subscriptions | insert | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| subscriptions | update | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| subscriptions | delete | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| billing_events | read | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| billing_events | insert | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| billing_events | update | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| billing_events | delete | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| client_subscriptions | read | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| client_subscriptions | insert | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| client_subscriptions | update | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| client_subscriptions | delete | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| access_invites | read | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| access_invites | insert | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| access_invites | update | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| access_invites | delete | DENY | pglite, live | PK section 2 path D — a viewer grant is not membership and carries no platform or organisation data |  |
| member list (standing grant holder is not a member) | read | DENY | pglite, live | PK section 2 path D — the holder never appears in the member list |  |
| app_private.viewer_tier() — specific grant overrides standing | execute | ALLOW | pglite, live | PK section 2 path D precedence |  |
| app_private.viewer_tier() — the client's entitlement caps the level | execute | ALLOW | pglite, live | PK section 2 path D — a grant can never widen access beyond the client's tier |  |
| revoking a specific grant leaves the standing grant in place | execute | ALLOW | pglite, live | PK section 2 path D — revoking standing removes all of it and leaves specific grants; the reverse also holds |  |
| viewer management for a client in the caller's own organisation | execute | DENY | pglite, live | Batch 5 — staff read the viewer list only; PK 3, PK 5 admit nothing here |  |
| practice_team | read | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | insert | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | update | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| practice_team | delete | DENY | pglite, live | Batch 5 — practice team readable by super admins only |  |
| manage the practice team (admin_add/remove_practice_member) | execute | DENY | pglite, live | Batch 5 — super-admin-only, unchanged by the advisors-page control |  |
| remove a staff member of the caller's own organisation | execute | DENY | pglite, live | Spec §15 — owner only; PK 5 admits no write from a support grant and PK 3 none from the role alone |  |
| server fn: read a client dashboard | execute | ALLOW | live | PK section 2 path D — read-only over every client in that organisation |  |
| server fn: write client data | execute | DENY | live | PK section 2 path D — a standing grant is READ-ONLY and never enters a write path |  |
| record a security attestation | execute | DENY | pglite, live | Spec §17 — super admin only; PK 2 requires aal2 and PK 1 admits nothing without it |  |
| security_attestations | read | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | insert | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | update | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| security_attestations | delete | DENY | pglite, live | Spec §17 — readable by super admins only |  |
| scenario_exclusions | insert | DENY | pglite, live | PK rule 11; PK section 2 path D — an External adviser grant is read-only, including scenario exclusions and reconciliation comments |  |
| scenario_exclusions | update | DENY | pglite, live | PK rule 11; PK section 2 path D — an External adviser grant is read-only, including scenario exclusions and reconciliation comments |  |
| scenario_exclusions | delete | DENY | pglite, live | PK rule 11; PK section 2 path D — an External adviser grant is read-only, including scenario exclusions and reconciliation comments |  |
| unreconciled_lines | insert | DENY | pglite, live | PK rule 11; PK section 2 path D — an External adviser grant is read-only, including scenario exclusions and reconciliation comments |  |
| unreconciled_lines | update | DENY | pglite, live | PK rule 11; PK section 2 path D — an External adviser grant is read-only, including scenario exclusions and reconciliation comments |  |
| unreconciled_lines | delete | DENY | pglite, live | PK rule 11; PK section 2 path D — an External adviser grant is read-only, including scenario exclusions and reconciliation comments |  |
| server fn: getClientOrgTrial | execute | DENY | live | Path D — an external adviser never sees billing, plan or organisation-level data | firm_viewer_access is not consulted by the function; without membership or a business_owner row the result is empty. |

## Super admin approving their own support grant

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| server fn: approveSupportAccess (own request) | update | DENY | pglite, live | PK 2 path B; Spec §7 (a super admin never approves their own access) |  |

## Business owner — one specific client (client_access with relationship = 'business_owner', self-service)

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| set_org_card_defaults(an organisation) | execute | DENY | pglite | app_private.assert_firm_member_write: active membership of this organisation only, deliberately not has_firm_access (which admits read-only support grants) |  |
| apply_org_card_defaults(an organisation) | execute | DENY | pglite | app_private.assert_firm_member_write: active membership of this organisation only, deliberately not has_firm_access (which admits read-only support grants) |  |
| server fn: getClientOrgTrial for their own client | execute | ALLOW | live | Path E — the business owner may see their client's plan and billing | public.client_org_trial asserts aal2, then returns the organisation's live trial (end date, days remaining, ending-soon flag) only when the caller is an active member of the client's organisation or holds a client_access row with relationship = 'business_owner' for that exact client. Only trial metadata is returned — never purchase detail, never another organisation. |
| server fn: getClientOrgTrial for a client that is not theirs | execute | DENY | live | PK 4 (a caller-supplied client_id is a FILTER, never a GRANT) | Neither predicate holds — no membership of that organisation and no business_owner row for that client — so the function returns no rows and the banner never renders. |

## Live smoke-suite test account (confined to ZZ Security Test Org, banned outside a run)

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| membership of a real organisation | insert | DENY | live | Live suite containment — app_private.confine_security_test_accounts() refuses even service_role |  |
| a platform role (user_roles) | insert | DENY | live | Live suite containment — app_private.confine_security_test_accounts() refuses even service_role |  |
| practice_team membership | insert | DENY | live | Live suite containment — app_private.confine_security_test_accounts() refuses even service_role |  |

## Active member on aal2, signed in today, with no recorded activity for more than 30 minutes

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| client_notes | read | DENY | pglite | PK 2 — the aal2 gate requires activity inside the 30 minute window |  |
| assert_aal2() with an idle session | execute | DENY | pglite | PK 2 — raises SESSION_IDLE before any MFA answer |  |
| touch_session_activity() | execute | DENY | pglite | PK 2 — an idle session cannot revive itself: the aal2 assertion fails first |  |
| assert_aal2() with no session_id claim | execute | DENY | pglite | PK 2 — an unverifiable session id fails closed |  |
| session_activity | update | DENY | pglite | PK 1 — activity timestamps are server-written only; no client write path |  |

## Active member who has just completed MFA: an aal2 session seconds old with no activity row written yet

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| client_notes | read | ALLOW | pglite | PK 2 — a brand-new session with no activity row is active from its start time |  |
| assert_aal2() immediately after MFA (no activity row yet) | execute | ALLOW | pglite | PK 2 — completing MFA is never refused as idle |  |
| touch_session_activity() | execute | ALLOW | pglite | PK 2 — the first activity write of a new session succeeds |  |

## Active member being ACTIVELY USED: an aal2 session that began 90 minutes ago whose last recorded activity is 2 minutes ago

| Resource | Operation | Expected | Layers | Rule | Notes |
| --- | --- | --- | --- | --- | --- |
| client_notes | read | ALLOW | pglite | PK 2 — recent recorded activity keeps a long-lived session active, whatever its age |  |
| assert_aal2() after 90 minutes of continuous use | execute | ALLOW | pglite | PK 2 — an actively used session is never refused as idle |  |
| touch_session_activity() | execute | ALLOW | pglite | PK 2 — an actively used session keeps recording its own activity, caller-scoped |  |
