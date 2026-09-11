create or replace function app_private.is_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'aal', '') = 'aal2'
$$;

revoke all on function app_private.is_aal2() from public;
grant execute on function app_private.is_aal2() to authenticated;

do $do$
declare t text;
begin
  foreach t in array array[
    'firms','firm_members','firm_support_access','clients','client_access','client_notes',
    'client_reports','client_subscriptions','client_xero_orgs','client_cost_classifications',
    'client_statutory_accounts','client_true_breakeven_inputs','consolidation_groups',
    'consolidation_group_members','loan_consolidation_accounts','loan_consolidation_snapshots',
    'reconciliation_snapshots','unreconciled_uploads','unreconciled_lines','scenario_exclusions',
    'xero_connections','xero_snapshots','xero_snapshot_runs','xero_api_errors',
    'xero_assessment_contact','audit_log','audit_runs','audit_findings','audit_finding_snoozes',
    'login_events','billing_events','subscriptions','signup_requests','access_invites',
    'report_recipients','report_cache','email_send_log','dashboard_configs',
    'dashboard_card_order','profiles'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'mfa_aal2_required', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (app_private.is_aal2()) with check (app_private.is_aal2())',
      'mfa_aal2_required', t);
  end loop;
end
$do$;