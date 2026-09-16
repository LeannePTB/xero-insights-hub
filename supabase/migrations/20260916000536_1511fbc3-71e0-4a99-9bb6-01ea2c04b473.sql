-- Wire the standalone posture checks into public.security_posture() itself, so
-- the Security page cannot silently omit one. Patched in place against the live
-- source with an anchor assertion, so the other ~20 checks are untouched.
do $do$
declare
  src text;
  anchor constant text := '  test_check := public.test_accounts_posture();
  checks := checks || test_check;';
  replacement constant text := '  test_check := public.test_accounts_posture();
  checks := checks || test_check;

  -- Checks that live in their own function so they can be read and proved on
  -- their own. They are appended HERE, not merged by the app: a check the
  -- database does not return is a check nobody sees.
  checks := checks || public.read_audit_posture();
  checks := checks || public.session_controls_posture();
  checks := checks || public.xero_rate_limit_posture();';
begin
  select p.prosrc into src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'security_posture'
    and pg_get_function_identity_arguments(p.oid) = '';

  if src is null then
    raise exception 'public.security_posture() not found';
  end if;
  if src like '%xero_rate_limit_posture%' then
    raise exception 'already wired';
  end if;
  if (length(src) - length(replace(src, anchor, ''))) / length(anchor) <> 1 then
    raise exception 'anchor not found exactly once in public.security_posture()';
  end if;

  execute 'create or replace function public.security_posture() returns jsonb '
       || 'language plpgsql stable security definer set search_path to '''' as '
       || quote_literal(replace(src, anchor, replacement));
end
$do$;

revoke execute on function public.security_posture() from public, anon;
grant execute on function public.security_posture() to authenticated;