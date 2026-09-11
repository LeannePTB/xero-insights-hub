-- 1. Server-owned presence timestamp: browsers can no longer choose last_seen_at.
CREATE OR REPLACE FUNCTION public.set_presence_seen_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
begin
  new.last_seen_at := now();
  return new;
end;
$$;

DROP TRIGGER IF EXISTS trg_user_presence_seen_at ON public.user_presence;
CREATE TRIGGER trg_user_presence_seen_at
BEFORE INSERT OR UPDATE ON public.user_presence
FOR EACH ROW EXECUTE FUNCTION public.set_presence_seen_at();

-- 2. Posture: add the PKCE check and per-function guard evidence.
CREATE OR REPLACE FUNCTION public.security_posture()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  checks jsonb := '[]'::jsonb;
  n int; n2 int; ev text;
  guards jsonb;
  retention_days int;
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;

  select count(*), coalesce(string_agg(tbl, ', '), '') into n, ev
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

  -- xero_required_scopes excluded: returns a fixed constant list, reads no table.
  select jsonb_agg(jsonb_build_object('fn', fn, 'pattern', pat) order by pat, fn),
         count(*) filter (where pat = 'none')
    into guards, n
  from (
    select p.proname::text fn,
           coalesce((regexp_match(p.prosrc,
             '(assert_aal2|is_aal2|me_is_super_admin|is_super_admin|has_firm_access|has_client_access|user_can_[a-z_]+|auth\.uid)'))[1],
             'none') pat
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.prosecdef
      and p.proname <> 'xero_required_scopes'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) q;
  checks := checks || jsonb_build_object(
    'id','definer_guards','title','Guarded SECURITY DEFINER functions',
    'status', case when n = 0 then 'ok' else 'action' end,
    'detail', case when n = 0 then 'Every definer function signed-in users can call mentions a caller guard.'
                   else n || ' callable definer function(s) with no caller guard.' end,
    'evidence', 'Text heuristic only: pg_proc.prosrc is searched for a guard name, it is not proof the guard runs on every path (a bare auth.uid() mention can still return rows when auth.uid() is null). '
                || coalesce(jsonb_array_length(guards),0) || ' function(s) scanned; xero_required_scopes excluded (constant list).',
    'matches', coalesce(guards, '[]'::jsonb));

  -- PKCE: every recent Xero authorisation request must carry a code verifier.
  select count(*) filter (where code_verifier is null or length(code_verifier) < 43),
         count(*)
    into n, n2
  from public.xero_oauth_states
  where created_at > now() - interval '90 days';
  checks := checks || jsonb_build_object(
    'id','xero_pkce','title','Xero sign-in uses PKCE',
    'status', case when n2 = 0 then 'warn' when n = 0 then 'ok' else 'action' end,
    'detail', case when n2 = 0 then 'Not verified — no Xero authorisation started in the last 90 days to check.'
                   when n = 0 then 'Every recent Xero authorisation carried a PKCE code verifier.'
                   else n || ' of ' || n2 || ' recent authorisation(s) had no usable code verifier.' end,
    'evidence', n2 || ' xero_oauth_states rows in the last 90 days, ' || n || ' without a code_verifier of 43+ characters');

  select count(*) into n from auth.users u
  where u.deleted_at is null
    and not exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status='verified');
  select count(*) into n2 from auth.users where deleted_at is null;
  checks := checks || jsonb_build_object(
    'id','user_mfa','title','Everyone has a second factor',
    'status', case when n = 0 then 'ok' else 'warn' end,
    'detail', (n2 - n) || ' of ' || n2 || ' people have a verified factor.',
    'evidence', n || ' without a verified TOTP factor (auth.mfa_factors)');

  select count(*) into n from public.user_roles r
  where r.role = 'super_admin'
    and not exists (select 1 from auth.mfa_factors f where f.user_id = r.user_id and f.status='verified');
  checks := checks || jsonb_build_object(
    'id','admin_mfa','title','Super admins have a second factor',
    'status', case when n = 0 then 'ok' else 'action' end,
    'detail', case when n = 0 then 'Every super admin holds a verified factor.'
                   else n || ' super admin(s) without a verified factor.' end,
    'evidence', n || ' of ' || (select count(*) from public.user_roles where role='super_admin') || ' super admins unenrolled');

  select count(*), coalesce(string_agg(relname::text, ', '), '') into n, ev
  from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname='public' and c.relkind='r' and not c.relrowsecurity;
  checks := checks || jsonb_build_object(
    'id','rls_enabled','title','Row level security on every table',
    'status', case when n = 0 then 'ok' else 'action' end,
    'detail', case when n = 0 then 'All public tables have RLS enabled.' else n || ' table(s) without RLS.' end,
    'evidence', case when n = 0 then 'pg_class.relrowsecurity true for all public tables' else ev end);

  select count(*), coalesce(string_agg(tbl, ', '), '') into n, ev
  from (
    select c.relname::text tbl from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relkind='r'
      and (has_table_privilege('anon', c.oid,'SELECT') or has_table_privilege('anon', c.oid,'INSERT')
        or has_table_privilege('anon', c.oid,'UPDATE') or has_table_privilege('anon', c.oid,'DELETE'))
  ) q;
  checks := checks || jsonb_build_object(
    'id','anon_grants','title','No anonymous table privileges',
    'status', case when n = 0 then 'ok' else 'action' end,
    'detail', case when n = 0 then 'The anonymous role holds no privilege on any public table.'
                   else n || ' table(s) grant privileges to anon.' end,
    'evidence', case when n = 0 then 'has_table_privilege(anon, ...) false everywhere' else ev end);

  -- service_role-only policies excluded: that role bypasses RLS by design.
  select count(*), coalesce(string_agg(tablename || '.' || policyname, ', '), '') into n, ev
  from pg_policies
  where schemaname='public' and coalesce(qual,'') = 'true'
    and tablename not in ('plan_levels','tier_settings')
    and not (roles::text[] <@ array['service_role']);
  checks := checks || jsonb_build_object(
    'id','using_true','title','No blanket USING (true) policy',
    'status', case when n = 0 then 'ok' else 'action' end,
    'detail', case when n = 0 then 'No data-table policy is unconditional for signed-in users.'
                   else n || ' unconditional policy(ies).' end,
    'evidence', case when n = 0 then 'pg_policies.qual scanned; service_role-only policies excluded' else ev end);

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='app_private' and p.proname='user_can_manage_client'
    and p.prosrc like '%platform_staff_can_access_firm%';
  checks := checks || jsonb_build_object(
    'id','support_write','title','Support grants are read-only',
    'status', case when n = 0 then 'ok' else 'action' end,
    'detail', case when n = 0 then 'No write path admits a support grant.'
                   else 'app_private.user_can_manage_client still admits a support grant; backlog item 18 is open.' end,
    'evidence', 'app_private.user_can_manage_client source inspected');

  select count(*), coalesce(string_agg(coalesce(f.name,'?') || ' → ' || coalesce(u.email,'?'), ', '), '') into n, ev
  from public.firm_support_access sa
  left join public.firms f on f.id = sa.firm_id
  left join auth.users u on u.id = sa.grantee_user_id
  where sa.granted and sa.revoked_at is null and sa.expires_at > now();
  checks := checks || jsonb_build_object(
    'id','support_grants','title','Active support grants',
    'status', case when n = 0 then 'ok' else 'warn' end,
    'detail', case when n = 0 then 'No organisation is under a support grant.' else n || ' active grant(s).' end,
    'evidence', case when n = 0 then 'firm_support_access: 0 granted, unrevoked, unexpired' else ev end);

  select count(*) into n from public.xero_connections where firm_id is null;
  checks := checks || jsonb_build_object(
    'id','xero_orphans','title','Every Xero connection belongs to an organisation',
    'status', case when n = 0 then 'ok' else 'warn' end,
    'detail', case when n = 0 then 'No orphaned connections.' else n || ' connection(s) with no organisation.' end,
    'evidence', n || ' rows in xero_connections with firm_id is null');

  select count(*) into n from public.xero_connections
  where status = 'connected' and expires_at < now() - interval '1 day';
  checks := checks || jsonb_build_object(
    'id','xero_tokens','title','Connected Xero files are refreshing',
    'status', case when n = 0 then 'ok' else 'warn' end,
    'detail', case when n = 0 then 'No connected file has a stale token.'
                   else n || ' connected file(s) with a token expired over a day ago.' end,
    'evidence', n || ' rows: status=connected and expires_at older than 24h');

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

  select coalesce(max(audit_retention_days), 730) into retention_days from public.security_settings;
  select count(*) into n from public.audit_log where at < now() - (retention_days || ' days')::interval;
  checks := checks || jsonb_build_object(
    'id','audit_retention','title','Audit log within retention',
    'status', case when n = 0 then 'ok' else 'warn' end,
    'detail', case when n = 0 then 'No audit rows past the ' || retention_days || '-day retention.'
                   else n || ' audit row(s) past the ' || retention_days || '-day retention.' end,
    'evidence', n || ' rows older than ' || retention_days || ' days');

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