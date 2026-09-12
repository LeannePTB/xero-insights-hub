-- Read-only dump of every SECURITY DEFINER function in `public` and `app_private`,
-- plus the policies and triggers that could call one, as a single JSON document.
-- Consumed by scripts/definer-register.ts. Never writes.
select json_build_object(
  'functions', coalesce((
    select json_agg(f order by f->>'schema', f->>'name', f->>'args')
    from (
      select json_build_object(
        'schema', ns.nspname,
        'name', p.proname,
        'args', pg_get_function_identity_arguments(p.oid),
        'returns', pg_get_function_result(p.oid),
        'volatility', case p.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end,
        'search_path', (
          select cfg from unnest(coalesce(p.proconfig, '{}'::text[])) cfg where cfg like 'search\_path=%'
        ),
        'executors', coalesce((
          select json_agg(distinct g.grantee::regrole::text order by g.grantee::regrole::text)
          from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) g
          where g.privilege_type = 'EXECUTE'
        ), '[]'::json),
        'body', p.prosrc
      ) f
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
      where ns.nspname in ('public', 'app_private')
        and p.prokind = 'f'
        and p.prosecdef
    ) s
  ), '[]'::json),
  'policies', coalesce((
    select json_agg(json_build_object(
      'table', c.relname,
      'name', pol.polname,
      'expr', coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' ||
              coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')
    ))
    from pg_policy pol join pg_class c on c.oid = pol.polrelid
    where c.relnamespace = 'public'::regnamespace
  ), '[]'::json),
  'triggers', coalesce((
    select json_agg(json_build_object(
      'table', c.relname,
      'name', tg.tgname,
      'function', fp.proname
    ))
    from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid
    join pg_proc fp on fp.oid = tg.tgfoid
    where c.relnamespace = 'public'::regnamespace and not tg.tgisinternal
  ), '[]'::json)
);
