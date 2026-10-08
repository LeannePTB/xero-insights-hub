-- 8 Oct 2026, owner request (Changes.docx item 3): let practice members stop
-- monitoring a client or a whole organisation on the Client overview.
--
-- Security shape:
--  * Two additive boolean columns, default false (nothing hidden today).
--  * Reads: overview_clients() excludes hidden rows — a NARROWING of an
--    existing read path, never a widening.
--  * Writes: two new caller-scoped definer functions, aal2 first, authorised
--    by the existing write predicates (user_can_write_client /
--    user_can_write_firm) — the same rule that gates acknowledging alerts.
--    Read predicates are never used for the write. Each change is audited.
--  * overview_hidden_items() lets the same writers see what is hidden so it
--    can be brought back; it returns ids and names only.

alter table public.clients add column overview_hidden boolean not null default false;
alter table public.firms add column overview_hidden boolean not null default false;

create or replace function public.overview_clients()
returns table(client_id uuid, client_name text, firm_id uuid, firm_name text)
language plpgsql
stable
set search_path to 'public'
as $function$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then
    return;
  end if;
  return query
    select c.id, c.name, f.id, f.name
      from public.clients c
      join public.firms f on f.id = c.firm_id
     where app_private.is_practice_member_of(auth.uid(), c.firm_id)
       and app_private.user_can_read_client(auth.uid(), c.id)
       and not c.overview_hidden
       and not f.overview_hidden
     order by f.name, c.name
     limit 1000;
end;
$function$;

create or replace function public.set_client_overview_hidden(_client_id uuid, _hidden boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform app_private.assert_aal2();
  if not app_private.user_can_write_client(auth.uid(), _client_id) then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  update public.clients set overview_hidden = _hidden where id = _client_id;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'client_overview_hidden_set', 'client', _client_id::text,
          jsonb_build_object('hidden', _hidden));
end;
$function$;
revoke execute on function public.set_client_overview_hidden(uuid, boolean) from public, anon;
grant execute on function public.set_client_overview_hidden(uuid, boolean) to authenticated;

create or replace function public.set_firm_overview_hidden(_firm_id uuid, _hidden boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform app_private.assert_aal2();
  if not app_private.user_can_write_firm(auth.uid(), _firm_id) then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  update public.firms set overview_hidden = _hidden where id = _firm_id;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'firm_overview_hidden_set', 'firm', _firm_id::text,
          jsonb_build_object('hidden', _hidden));
end;
$function$;
revoke execute on function public.set_firm_overview_hidden(uuid, boolean) from public, anon;
grant execute on function public.set_firm_overview_hidden(uuid, boolean) to authenticated;

-- What is hidden that I could bring back? Caller-scoped: only rows the caller
-- could unhide (write predicate), so this never leaks other organisations.
create or replace function public.overview_hidden_items()
returns table(kind text, id uuid, name text, firm_id uuid, firm_name text)
language plpgsql
stable
set search_path to 'public'
as $function$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then
    return;
  end if;
  return query
    select 'client'::text, c.id, c.name, f.id, f.name
      from public.clients c
      join public.firms f on f.id = c.firm_id
     where c.overview_hidden
       and not f.overview_hidden
       and app_private.user_can_write_client(auth.uid(), c.id)
    union all
    select 'organisation'::text, f.id, f.name, f.id, f.name
      from public.firms f
     where f.overview_hidden
       and app_private.user_can_write_firm(auth.uid(), f.id)
     order by 5, 3
     limit 1000;
end;
$function$;
revoke execute on function public.overview_hidden_items() from public, anon;
grant execute on function public.overview_hidden_items() to authenticated;