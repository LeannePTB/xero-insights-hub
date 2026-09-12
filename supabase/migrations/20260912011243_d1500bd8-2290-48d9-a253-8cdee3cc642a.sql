-- Phase 7 batch 1: reduce `authenticated` table privileges to the intersection of
-- what it already holds and what a permissive policy for `authenticated` admits.
-- Purely reductive: nothing is granted that was not already held, so no access can widen.
-- `anon` holds nothing today and is revoked again defensively. `service_role` untouched.

-- 1. Full read/write tables (a permissive policy exists for every command).
revoke all on table
  public.access_invites, public.audit_finding_snoozes, public.client_access,
  public.client_cost_classifications, public.client_notes, public.client_statutory_accounts,
  public.client_true_breakeven_inputs, public.client_xero_orgs, public.clients,
  public.consolidation_group_members, public.consolidation_groups, public.dashboard_card_order,
  public.dashboard_configs, public.firm_members, public.loan_consolidation_accounts,
  public.loan_consolidation_snapshots, public.plan_levels, public.report_cache,
  public.scenario_exclusions, public.tier_settings, public.tier_widget_config,
  public.unreconciled_lines, public.unreconciled_uploads, public.user_roles,
  public.xero_assessment_contact, public.xero_oauth_states
from anon, authenticated;

grant select, insert, update, delete on table
  public.access_invites, public.audit_finding_snoozes, public.client_access,
  public.client_cost_classifications, public.client_notes, public.client_statutory_accounts,
  public.client_true_breakeven_inputs, public.client_xero_orgs, public.clients,
  public.consolidation_group_members, public.consolidation_groups, public.dashboard_card_order,
  public.dashboard_configs, public.firm_members, public.loan_consolidation_accounts,
  public.loan_consolidation_snapshots, public.plan_levels, public.report_cache,
  public.scenario_exclusions, public.tier_settings, public.tier_widget_config,
  public.unreconciled_lines, public.unreconciled_uploads, public.user_roles,
  public.xero_assessment_contact, public.xero_oauth_states
to authenticated;

-- 2. Read-only tables (only permissive SELECT policies, or writes deliberately
--    revoked in an earlier phase: firms, client_subscriptions, audit_log).
revoke all on table
  public.audit_findings, public.audit_log, public.audit_runs, public.billing_events,
  public.client_reports, public.client_subscriptions, public.firms, public.login_events,
  public.profiles, public.reconciliation_snapshots, public.report_recipients,
  public.security_settings, public.security_test_runs, public.subscriptions,
  public.xero_api_errors, public.xero_snapshot_runs, public.xero_snapshots
from anon, authenticated;

grant select on table
  public.audit_findings, public.audit_log, public.audit_runs, public.billing_events,
  public.client_reports, public.client_subscriptions, public.firms, public.login_events,
  public.profiles, public.reconciliation_snapshots, public.report_recipients,
  public.security_settings, public.security_test_runs, public.subscriptions,
  public.xero_api_errors, public.xero_snapshot_runs, public.xero_snapshots
to authenticated;

-- 3. Read / insert / update only (no delete policy).
revoke all on table public.firm_support_access, public.user_presence from anon, authenticated;
grant select, insert, update on table public.firm_support_access, public.user_presence to authenticated;

-- 4. Read + update only (super-admin update policies).
revoke all on table public.signup_requests from anon, authenticated;
grant select, update on table public.signup_requests to authenticated;

-- 5. System-only tables: every permissive policy is service-role-only or an
--    explicit deny, and every app path uses the service-role client.
revoke all on table
  public.email_send_log, public.email_send_state, public.email_unsubscribe_tokens,
  public.suppressed_emails, public.rate_limit_buckets, public.security_contact_details
from anon, authenticated;

-- 6. Xero connections: no table privilege at all; the 13 non-token columns only.
revoke all on table public.xero_connections from anon, authenticated;

-- 7. Column grants, re-granted after the revokes above.
grant select (id, user_id, firm_id, tenant_id, tenant_name, tenant_type, scopes,
              status, disconnected_at, base_currency, expires_at, created_at, updated_at)
  on table public.xero_connections to authenticated;
grant select (id, firm_id, email, role, invited_by, expires_at, accepted_at, created_at)
  on table public.access_invites to authenticated;
grant update (display_name) on table public.profiles to authenticated;
grant update (client_comment) on table public.unreconciled_lines to authenticated;