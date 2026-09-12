-- Dumps a structural mirror of the live access-control layer for the PGlite
-- matrix suite. READ-ONLY: it only reads system catalogues.
--
-- Emitted, in order:
--   1  enum types
--   2  table definitions (columns + types only; defaults and constraints are
--      deliberately omitted so synthetic rows can be inserted freely)
--   3  app_private / public authorisation + definer function bodies
--   4  RLS enablement
--   5  table-level grants for anon / authenticated / service_role
--   6  column-level grants for anon / authenticated / service_role
--   7  every policy: every command, permissive AND restrictive, with roles
--   8  the catalogue fingerprint

\pset footer off

with tabs as (
  select c.oid, c.relname::text t
  from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public' and c.relkind = 'r'
),
fns as (
  select p.oid
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where p.prokind = 'f'
    and p.prorettype <> 'trigger'::regtype
    and (
      ns.nspname = 'app_private'
      or (ns.nspname = 'public' and p.proname in (
        'user_can_access_firm','user_can_access_client','firm_access_path',
        'client_entitlement','client_allowed_widgets','client_can_use_widget',
        'assert_client_write_access','set_client_widget_enabled',
        'delete_client_report','transfer_organisation_ownership','remove_firm_member',
        'set_all_client_tiers','online_users','set_profile_display_name_admin',
        'xero_missing_scopes','xero_required_scopes','has_role'))
    )
),
stmts as (
  select 1 ord, t.typname::text k,
         'create type public.' || quote_ident(t.typname) || ' as enum (' ||
         (select string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder)
            from pg_enum e where e.enumtypid = t.oid) || ');' stmt
    from pg_type t
   where t.typnamespace = 'public'::regnamespace and t.typtype = 'e'

  union all
  select 2, tabs.t,
         'create table public.' || quote_ident(tabs.t) || ' (' ||
         (select string_agg(quote_ident(a.attname) || ' ' || format_type(a.atttypid, a.atttypmod),
                            ', ' order by a.attnum)
            from pg_attribute a
           where a.attrelid = tabs.oid and a.attnum > 0 and not a.attisdropped) || ');'
    from tabs

  union all
  select 3, p.oid::text, pg_get_functiondef(p.oid) || ';'
    from fns f join pg_proc p on p.oid = f.oid

  -- the generic audit trigger function and its attachments (backlog 29)
  union all
  select 3, 'trgfn:' || p.oid::text, pg_get_functiondef(p.oid) || ';'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.prorettype = 'trigger'::regtype
     and p.proname = 'audit_table_change'

  union all
  select 8, tabs.t || '/' || tg.tgname, pg_get_triggerdef(tg.oid) || ';'
    from tabs join pg_trigger tg on tg.tgrelid = tabs.oid and not tg.tgisinternal
    join pg_proc p on p.oid = tg.tgfoid
   where p.proname = 'audit_table_change'

  union all
  select 4, tabs.t, 'alter table public.' || quote_ident(tabs.t) || ' enable row level security;'
    from tabs

  -- table-level grants, exactly as live
  union all
  select 5, tabs.t || '/' || g.grantee || '/' || g.privilege_type,
         'grant ' || g.privilege_type || ' on table public.' || quote_ident(tabs.t)
         || ' to ' || quote_ident(g.grantee) || ';'
    from tabs
    cross join lateral (
      select grantee::regrole::text grantee, privilege_type
        from aclexplode(coalesce(
               (select relacl from pg_class where oid = tabs.oid),
               '{}'::aclitem[]))
    ) g
   where g.grantee in ('anon','authenticated','service_role')
     and g.privilege_type <> 'MAINTAIN'

  -- column-level grants (xero_connections non-token columns live here)
  union all
  select 6, tabs.t || '/' || a.attname || '/' || g.grantee || '/' || g.privilege_type,
         'grant ' || g.privilege_type || ' (' || quote_ident(a.attname) || ') on table public.'
         || quote_ident(tabs.t) || ' to ' || quote_ident(g.grantee) || ';'
    from tabs
    join pg_attribute a on a.attrelid = tabs.oid and a.attnum > 0 and not a.attisdropped
                       and a.attacl is not null
    cross join lateral (
      select grantee::regrole::text grantee, privilege_type from aclexplode(a.attacl)
    ) g
   where g.grantee in ('anon','authenticated','service_role')

  -- every policy: every command, permissive and restrictive
  union all
  select 7, tabs.t || '/' || pol.polname,
         'create policy ' || quote_ident(pol.polname) || ' on public.' || quote_ident(tabs.t)
         || ' as ' || case when pol.polpermissive then 'permissive' else 'restrictive' end
         || ' for ' || case pol.polcmd when 'r' then 'select' when 'a' then 'insert'
                                       when 'w' then 'update' when 'd' then 'delete'
                                       else 'all' end
         || ' to ' || coalesce(
              (select string_agg(quote_ident(r.rolname), ', ' order by r.rolname)
                 from unnest(pol.polroles) pr join pg_roles r on r.oid = pr
                where r.rolname in ('anon','authenticated','service_role')),
              'public')
         || coalesce(' using (' || pg_get_expr(pol.polqual, pol.polrelid) || ')', '')
         || coalesce(' with check (' || pg_get_expr(pol.polwithcheck, pol.polrelid) || ')', '')
         || ';'
    from tabs join pg_policy pol on pol.polrelid = tabs.oid
)
select string_agg(stmt, E'\n' order by ord, k) from stmts;

-- Fingerprint: any change to a policy, grant or authorisation function body
-- changes this value, so a stale fixture is detectable.
select E'\n-- catalogue-fingerprint: ' || encode(sha256(convert_to(string_agg(sig, '|' order by sig), 'UTF8')), 'hex')
from (
  select 'pol:' || c.relname || ':' || pol.polname || ':' || pol.polcmd::text
         || ':' || pol.polpermissive::text
         || ':' || coalesce(pg_get_expr(pol.polqual, pol.polrelid), '')
         || ':' || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') sig
    from pg_policy pol join pg_class c on c.oid = pol.polrelid
   where c.relnamespace = 'public'::regnamespace
  union all
  select 'acl:' || c.relname || ':' || coalesce(c.relacl::text, '')
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  union all
  select 'colacl:' || c.relname || ':' || a.attname || ':' || a.attacl::text
    from pg_class c join pg_attribute a on a.attrelid = c.oid
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and a.attacl is not null
  union all
  select 'trg:' || c.relname || ':' || tg.tgname || ':' || pg_get_triggerdef(tg.oid)
    from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
   where c.relnamespace = 'public'::regnamespace and not tg.tgisinternal
  union all
  select 'fn:' || ns.nspname || '.' || p.proname || ':' || md5(p.prosrc)
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname in ('app_private','public') and p.prokind = 'f'
) s;
