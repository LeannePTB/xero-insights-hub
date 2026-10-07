-- Switch the two overview functions to SECURITY INVOKER: they run with the
-- caller's own privileges and RLS, calling only existing app_private helpers.
-- Same behaviour, narrower: clients and firms are read through RLS as the caller.

create or replace function public.me_is_practice_member()
returns boolean
language plpgsql
stable
security invoker
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1 from public.my_firm_memberships() m
     where app_private.is_practice_member_of(auth.uid(), m.firm_id)
  );
end;
$$;

create or replace function public.overview_clients()
returns table(client_id uuid, client_name text, firm_id uuid, firm_name text)
language plpgsql
stable
security invoker
set search_path to 'public'
as $$
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
     order by f.name, c.name
     limit 1000;
end;
$$;

revoke execute on function public.me_is_practice_member() from public, anon;
revoke execute on function public.overview_clients() from public, anon;
grant execute on function public.me_is_practice_member() to authenticated, service_role;
grant execute on function public.overview_clients() to authenticated, service_role;