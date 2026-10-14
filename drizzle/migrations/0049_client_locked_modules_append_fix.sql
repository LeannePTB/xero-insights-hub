create or replace function public.client_locked_modules(_client_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _firm uuid;
  _cards text[];
  _consolidation boolean;
  _client_count int;
  _out text[] := '{}';
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then return '{}'; end if;
  select firm_id into _firm from public.clients where id = _client_id;
  if _firm is null
     or not app_private.user_can_read_client(auth.uid(), _client_id)
     or not public.me_can_manage_cards(_firm) then
    return '{}';
  end if;
  _cards := coalesce(app_private.client_cards_v2(_client_id), '{}');
  select coalesce(array_agg(m.module_key order by m.sort_order, m.module_key), '{}') into _out
    from public.card_modules m
   where exists (select 1 from public.card_catalogue c where c.module_key = m.module_key and c.package = 'advisory')
     and not exists (select 1 from public.card_catalogue c
                      where c.module_key = m.module_key and c.package = 'advisory' and c.card_key = any(_cards));
  select o.consolidation into _consolidation from app_private.org_effective_options(_firm) o;
  select count(*) into _client_count from public.clients where firm_id = _firm;
  if not coalesce(_consolidation, false) and _client_count > 1
     and not exists (select 1 from public.card_catalogue c where c.package = 'consolidation' and c.card_key = any(_cards)) then
    _out := array_append(_out, 'consolidation'::text);
  end if;
  return _out;
end;
$$;
revoke execute on function public.client_locked_modules(uuid) from public, anon;
grant execute on function public.client_locked_modules(uuid) to authenticated;