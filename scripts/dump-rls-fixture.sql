with tabs(t) as (values
 ('xero_connections'),('clients'),('firms'),('firm_members'),('client_xero_orgs'),('client_notes'),
 ('xero_snapshots'),('client_reports'),('reconciliation_snapshots'),('report_cache'),('audit_log'),
 ('subscriptions'),('client_subscriptions'),('consolidation_groups'),('loan_consolidation_snapshots'),
 ('unreconciled_lines'),('unreconciled_uploads'),('xero_oauth_states'),('client_access'),('firm_support_access'),('user_roles'))
select string_agg(stmt, E'\n') from (
  -- enum types
  select 1 as ord, 'create type public.'||quote_ident(t.typname)||' as enum ('||
         (select string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder)
            from pg_enum e where e.enumtypid=t.oid)||');' as stmt
    from pg_type t where t.typnamespace='public'::regnamespace and t.typtype='e'
  union all
  -- tables
  select 2, 'create table public.'||quote_ident(c.relname)||' ('||
     (select string_agg(quote_ident(a.attname)||' '||format_type(a.atttypid,a.atttypmod), ', ' order by a.attnum)
        from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)||');'
    from pg_class c where c.relnamespace='public'::regnamespace and c.relname in (select t from tabs)
  union all
  -- helper functions
  select 3, pg_get_functiondef(p.oid)||';'
    from pg_proc p
   where (p.pronamespace='app_private'::regnamespace
      or (p.pronamespace='public'::regnamespace and p.proname in
          ('user_can_access_firm','user_can_access_client','firm_access_path','client_entitlement','me_is_super_admin','client_allowed_widgets','client_can_use_widget')))
     and p.prokind='f' and p.prorettype <> 'trigger'::regtype
  union all
  select 4, 'alter table public.'||quote_ident(c.relname)||' enable row level security;'
    from pg_class c where c.relnamespace='public'::regnamespace and c.relname in (select t from tabs)
  union all
  select 5, 'grant select on public.'||quote_ident(c.relname)||' to authenticated;'
    from pg_class c where c.relnamespace='public'::regnamespace and c.relname in (select t from tabs)
  union all
  select 6, 'create policy '||quote_ident(pol.polname)||' on public.'||quote_ident(c.relname)||
     ' for select to authenticated using ('||pg_get_expr(pol.polqual, pol.polrelid)||');'
    from pg_policy pol join pg_class c on c.oid=pol.polrelid
   where c.relnamespace='public'::regnamespace and c.relname in (select t from tabs)
     and pol.polcmd in ('r','*') and pol.polqual is not null
  order by 1
) s;
