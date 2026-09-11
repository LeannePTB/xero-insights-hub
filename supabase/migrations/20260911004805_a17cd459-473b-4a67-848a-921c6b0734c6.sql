-- Phase 1b: presence + one live security posture computation.

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

grant select, insert, update on public.user_presence to authenticated;
grant all on public.user_presence to service_role;

alter table public.user_presence enable row level security;

create policy "users read own presence" on public.user_presence
  for select to authenticated using (user_id = auth.uid());
create policy "users insert own presence" on public.user_presence
  for insert to authenticated with check (user_id = auth.uid());
create policy "users update own presence" on public.user_presence
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mfa_aal2_required on public.user_presence
  as restrictive for all to authenticated
  using (app_private.is_aal2()) with check (app_private.is_aal2());

-- Single source of truth for the posture checks. Path C platform metadata:
-- super admin only, aal2 only, no organisation or client financial data.
create or replace function public.security_posture()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  checks jsonb := '[]'::jsonb;
  n int; n2 int; txt text; ev text;
  retention_days int;
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;

  -- 1. Server-side aal2 enforcement: tables in scope without the restrictive policy.
  select count(*), coalesce(string_agg(tbl, ', '), '')
    into n, ev
  from (
    select c.relname::text tbl
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind = 'r'
      and c.relname not in ('plan_levels','tier_settings')
      and (has_table_privilege('authenticated', c.oid, 'SELECT')
        or has_table_privilege('authenticated', c.oid, 'INSERT')
        or has_table_privilege('authenticated', c.oid, 'UPDATE')
        or has_table_privilege('authenticated', c.oid, 'DELETE'))
      and not exists (select 1 from pg_policies p
                      where p.schemaname='public' and p.tablename=c.relname
                        and p.policyname='mfa_aal2_required')
  ) q;
  checks := checks || jsonb_build_object(
    'id','aal2_tables','title','Two-factor required on every data table',
    'status', case when n = 0 then 'ok' else 'action' end,
    'detail', case when n = 0 then 'All in-scope tables carry the restrictive aal2 policy.'
                   else n || ' table(s) missing the aal2 policy.' end,
    'evidence', case when n = 0
      then (select count(*)::text || ' tables with mfa_aal2_required'
            from pg_policies where schemaname='public' and policyname='mfa_aal2_required')
      else ev end);

  -- 2. SECURITY DEFINER functions callable by authenticated without a caller guard.
  select count(*), coalesce(string_agg(fn, ', '), '') into n, ev
  from (
    select p.proname::text fn
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and p.prosrc !~ '(assert_aal2|is_aal2|me_is_super_admin|is_super_admin|has_firm_access|has_client_access|user_can_|auth\.uid)'
  ) q;
  checks := checks || jsonb_build_object(
    'id','definer_guards','title','Guarded SECURITY DEFINER functions',
    'status', case when n = 0 then 'ok' else 'action' end,
    'detail', case when n = 0 then 'Every definer function signed-in users can call checks the caller.'
                   else n || ' callable definer function(s) with no caller guard.' end,
    'evidence', case when n = 0 then 'checked pg_proc.prosrc for a caller guard' else ev end);

  -- 3. People without a verified second factor.
  select count(*) into n from auth.users u
  where u.deleted_at is null
    and not exists (select 1 from auth.mfa_factors f
                    where f.user_id = u.id and f.status = 'verified');
  select count(*) into n2 from auth.users where deleted_at is null;
  checks := checks || jsonb_build_object(
    'id','user_mfa','title','Everyone has a second factor',
    'status', case when n = 0 then 'ok' else 'warn' end,
    'detail', (n2 - n) || ' of ' || n2 || ' people have a verified factor.',
    'evidence', n || ' without a verified TOTP factor (auth.mfa_factors)');

  -- 4. Super admins without a verified second factor.
  select count(*) into n from public.user_roles r
  where r.role = 'super_admin'
    and not exists (select 1 from auth.mfa_factors f
                    where f.user_id = r.user_id and f.status = 'verified');
  checks := checks || jsonb_build_object(
    'id','admin_mfa','title','Super admins have a second factor',
    'status', case when n = 0 then 'ok' else 'action' end,
    'detail', case when n = 0 then 'Every super admin holds a verified factor.'
                   else n || ' super admin(s) without a verified factor.' end,
    'evidence', n || ' of ' || (select count(*) from public.user_roles where role='super_admin')
                  || ' super admins unenrolled');

  -- 5. public tables without RLS.
  select count(*), coalesce(string_agg(relname::text, ', '), '') into n, ev
  from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname='public' and c.relkind='r' and not c.relrowsecurity;
  checks := checks || jsonb_build_object(
    'id','rls_enabled','title','Row level security on every table',
    'status', case when n = 0 then 'ok' else 'action' end,
    'detail', case when n = 0 then 'All public tables have RLS enabled.' else n || ' table(s) without RLS.' end,
    'evidence', case when n = 0 then 'pg_class.relrowsecurity true for all public tables' else ev end);

  -- 6. anon privileges on public tables.
  select count(*), coalesce(string_agg(tbl, ', '), '') into n, ev
  from (
    select c.relname::text tbl from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relkind='r'
      and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid,'INSERT')
        or has_table_privilege('anon', c.oid,'UPDATE') or has_table_privilege('anon', c.oid,'DELETE'))
  ) q;
  checks := checks || jsonb_build_object(
    'id','anon_grants','title','No anonymous table privileges',
    'status', case when n = 0 then 'ok' else 'action' end,
    'detail', case when n = 0 then 'The anonymous role holds no privilege on any public table.'
                   else n || ' table(s) grant privileges to anon.' end,
    'evidence', case when n = 0 then 'has_table_privilege(anon, ...) false everywhere' else ev end);

  -- 7. USING (true) policies on data tables.
  select count(*), coalesce(string_agg(tablename || '.' || policyname, ', '), '') into n, ev
  from pg_policies
  where schemaname='public' and coalesce(qual,'') = 'true'
    and tablename not in ('plan_levels','tier_settings');
  checks := checks || jsonb_build_object(
    'id','using_true','title','No blanket USING (true) policy',
    'status', case when n = 0 then 'ok' else 'action' end,
    'detail', case when n = 0 then 'No data-table policy is unconditional.' else n || ' unconditional policy(ies).' end,
    'evidence', case when n = 0 then 'pg_policies.qual scanned' else ev end);

  -- 8. Write policies that admit a support grant (backlog item 18).
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='app_private' and p.proname='user_can_manage_client'
    and p.prosrc like '%platform_staff_can_access_firm%';
  checks := checks || jsonb_build_object(
    'id','support_write','title','Support grants are read-only',
    'status', case when n = 0 then 'ok' else 'action' end,
    'detail', case when n = 0 then 'No write path admits a support grant.'
                   else 'app_private.user_can_manage_client still admits a support grant; backlog item 18 is open.' end,
    'evidence', 'app_private.user_can_manage_client source inspected');

  -- 9. Active support grants.
  select count(*), coalesce(string_agg(coalesce(f.name,'?') || ' → ' || coalesce(u.email,'?'), ', '), '')
    into n, ev
  from public.firm_support_access sa
  left join public.firms f on f.id = sa.firm_id
  left join auth.users u on u.id = sa.grantee_user_id
  where sa.granted and sa.revoked_at is null and sa.expires_at > now();
  checks := checks || jsonb_build_object(
    'id','support_grants','title','Active support grants',
    'status', case when n = 0 then 'ok' else 'warn' end,
    'detail', case when n = 0 then 'No organisation is under a support grant.' else n || ' active grant(s).' end,
    'evidence', case when n = 0 then 'firm_support_access: 0 granted, unrevoked, unexpired' else ev end);

  -- 10. Xero connections with no organisation.
  select count(*) into n from public.xero_connections where firm_id is null;
  checks := checks || jsonb_build_object(
    'id','xero_orphans','title','Every Xero connection belongs to an organisation',
    'status', case when n = 0 then 'ok' else 'warn' end,
    'detail', case when n = 0 then 'No orphaned connections.' else n || ' connection(s) with no organisation.' end,
    'evidence', n || ' rows in xero_connections with firm_id is null');

  -- 11. Connected Xero files whose token has expired.
  select count(*) into n from public.xero_connections
  where status = 'connected' and expires_at < now() - interval '1 day';
  checks := checks || jsonb_build_object(
    'id','xero_tokens','title','Connected Xero files are refreshing',
    'status', case when n = 0 then 'ok' else 'warn' end,
    'detail', case when n = 0 then 'No connected file has a stale token.'
                   else n || ' connected file(s) with a token expired over a day ago.' end,
    'evidence', n || ' rows: status=connected and expires_at older than 24h');

  -- 12. Plaintext tokens.
  select count(*) into n from information_schema.columns
  where table_schema='public' and table_name='xero_connections'
    and column_name in ('access_token','refresh_token');
  select count(*) into n2 from public.xero_connections
  where status='connected' and (access_token_enc is null or refresh_token_enc is null);
  checks := checks || jsonb_build_object(
    'id','token_storage','title','Xero tokens stored encrypted only',
    'status', case when n = 0 and n2 = 0 then 'ok' else 'action' end,
    'detail', case when n = 0 and n2 = 0 then 'All stored tokens are in the encrypted columns.'
                   else n || ' plaintext column(s), ' || n2 || ' connected file(s) missing an encrypted token.' end,
    'evidence', 'information_schema.columns + xero_connections null check');

  -- 13. Audit rows past retention.
  select coalesce(max(audit_retention_days), 730) into retention_days from public.security_settings;
  select count(*) into n from public.audit_log where at < now() - (retention_days || ' days')::interval;
  checks := checks || jsonb_build_object(
    'id','audit_retention','title','Audit log within retention',
    'status', case when n = 0 then 'ok' else 'warn' end,
    'detail', case when n = 0 then 'No audit rows past the ' || retention_days || '-day retention.'
                   else n || ' audit row(s) past the ' || retention_days || '-day retention.' end,
    'evidence', n || ' rows older than ' || retention_days || ' days');

  -- 14. Audit log append-only for signed-in users.
  select count(*) into n from pg_policies
  where schemaname='public' and tablename='audit_log' and cmd in ('INSERT','UPDATE','DELETE','ALL')
    and 'authenticated' = any(roles);
  select count(*) into n2 from information_schema.role_table_grants
  where table_schema='public' and table_name='audit_log' and grantee='authenticated'
    and privilege_type in ('INSERT','UPDATE','DELETE');
  checks := checks || jsonb_build_object(
    'id','audit_append_only','title','Audit log is append-only',
    'status', case when n = 0 and n2 = 0 then 'ok' else 'action' end,
    'detail', case when n = 0 and n2 = 0 then 'Signed-in users hold no write privilege or write policy on the audit log.'
                   else 'Signed-in users can write to the audit log.' end,
    'evidence', n || ' write policies, ' || n2 || ' write grants for authenticated');

  return jsonb_build_object('generated_at', now(), 'checks', checks);
end;
$function$;

revoke execute on function public.security_posture() from public, anon;
grant execute on function public.security_posture() to authenticated;

-- Presence read for the card: super admin + aal2 only, name and MFA state only.
create or replace function public.online_users(_window_minutes int default 5)
returns table(user_id uuid, display_name text, email text, is_super_admin boolean,
              has_mfa boolean, last_seen_at timestamptz)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  return query
    select p.user_id,
           pr.display_name,
           pr.email,
           exists (select 1 from public.user_roles r where r.user_id = p.user_id and r.role='super_admin'),
           exists (select 1 from auth.mfa_factors f where f.user_id = p.user_id and f.status='verified'),
           p.last_seen_at
    from public.user_presence p
    left join public.profiles pr on pr.id = p.user_id
    where p.last_seen_at > now() - make_interval(mins => greatest(1, least(_window_minutes, 60)))
    order by p.last_seen_at desc;
end;
$function$;

revoke execute on function public.online_users(int) from public, anon;
grant execute on function public.online_users(int) to authenticated;
