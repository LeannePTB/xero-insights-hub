-- Client overview (Batch 1). Two caller-scoped, aal2-guarded read functions.
-- Neither grants access: overview_clients() narrows to clients in organisations
-- where the caller is an ACTIVE member AND on the practice team (Path A), and
-- re-checks the existing read predicate per client.

create or replace function public.me_is_practice_member()
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  return exists (
    select 1
      from public.practice_team pt
      join public.firm_members fm on fm.user_id = pt.user_id
     where pt.user_id = auth.uid()
       and fm.status = 'active'
  );
end;
$$;

create or replace function public.overview_clients()
returns table(client_id uuid, client_name text, firm_id uuid, firm_name text)
language plpgsql
stable
security definer
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