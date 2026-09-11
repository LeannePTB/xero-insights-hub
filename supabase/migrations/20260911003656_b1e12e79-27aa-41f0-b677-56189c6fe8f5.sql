create or replace function app_private.assert_aal2()
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not app_private.is_aal2() then
    raise exception 'MFA_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  return true;
end;
$$;

revoke all on function app_private.assert_aal2() from public;
grant execute on function app_private.assert_aal2() to authenticated;

do $do$
declare
  r record;
  def text;
  prefix text;
  body text;
  newbody text;
  guarded int := 0;
begin
  for r in
    select p.oid, p.proname, l.lanname
      from pg_proc p
      join pg_language l on l.oid = p.prolang
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and has_function_privilege('authenticated', p.oid, 'EXECUTE')
       and p.proname not in ('xero_required_scopes', 'xero_missing_scopes')
  loop
    def := pg_get_functiondef(r.oid);

    if def like '%app_private.assert_aal2()%' then
      continue;
    end if;

    prefix := substring(def from '^(.*?AS \$function\$)');
    if prefix is null then
      raise exception 'Cannot locate body delimiter for %', r.proname;
    end if;
    body := substr(def, length(prefix) + 1);

    if r.lanname = 'sql' then
      newbody := E'\n  select app_private.assert_aal2();\n' || body;
    elsif r.lanname = 'plpgsql' then
      if body !~* '(^|\n)[ \t]*begin[ \t]*(\n|$)' then
        raise exception 'Cannot locate BEGIN in %', r.proname;
      end if;
      newbody := regexp_replace(
        body,
        '(^|\n)([ \t]*)(begin)([ \t]*)(\n|$)',
        E'\\1\\2\\3\\4\\5\\2  perform app_private.assert_aal2();\n',
        'i'
      );
      if newbody = body then
        raise exception 'Guard not inserted for %', r.proname;
      end if;
    else
      raise exception 'Unexpected language % for %', r.lanname, r.proname;
    end if;

    execute prefix || newbody;
    guarded := guarded + 1;
  end loop;

  raise notice 'aal2 guard added to % function(s)', guarded;
end
$do$;