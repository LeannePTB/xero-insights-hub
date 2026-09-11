do $$
declare
  src text;
  old_block text;
  new_block text;
begin
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'security_posture';

  old_block := $q$  select count(*), coalesce(string_agg(name, ', '), '') into n, ev
  from public.firms
  where is_always_free and id <> app_private.practice_firm_id();
  checks := checks || jsonb_build_object(
    'id','always_free','title','Always-free flag on the practice organisation only',
    'status', case when n = 0 then 'ok' else 'action' end,
    'detail', case when n = 0 then 'Only the practice organisation is marked always free.'
                   else n || ' client organisation(s) marked always free.' end,
    'evidence', case when n = 0 then 'public.firms: is_always_free true only for the recorded practice organisation'
                     else ev end);$q$;

  new_block := $q$  select count(*), coalesce(string_agg(name, ', '), '') into n, ev
  from public.firms
  where is_always_free and id is distinct from app_private.practice_firm_id();
  checks := checks || jsonb_build_object(
    'id','always_free','title','Always-free flag on the practice organisation only',
    'status', case when app_private.practice_firm_id() is null then 'action'
                   when n = 0 then 'ok' else 'action' end,
    'detail', case when app_private.practice_firm_id() is null
                     then 'The practice organisation is not recorded, so the always-free rule cannot be evidenced.'
                   when n = 0 then 'Only the practice organisation is marked always free.'
                   else n || ' client organisation(s) marked always free.' end,
    'evidence', case when app_private.practice_firm_id() is null
                     then 'app_private.platform_settings has no practice_firm_id'
                     when n = 0 then 'public.firms: is_always_free true only for the recorded practice organisation'
                     else ev end);$q$;

  if position(old_block in src) = 0 then
    raise exception 'always_free block not found in security_posture(); refusing to patch';
  end if;

  execute replace(src, old_block, new_block);
end;
$$;