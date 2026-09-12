-- Caller-scoped public wrappers so server functions can prove authorisation
-- BEFORE any privileged step (rule 7). No user-id parameter: always auth.uid().
create or replace function public.me_can_manage_client_viewers(_client_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then return false; end if;
  return app_private.can_manage_viewers_for_client(auth.uid(), _client_id);
end;
$$;

create or replace function public.me_can_manage_firm_viewers(_firm_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then return false; end if;
  return app_private.can_manage_client_viewers(auth.uid(), _firm_id);
end;
$$;

revoke all on function public.me_can_manage_client_viewers(uuid) from public;
revoke all on function public.me_can_manage_client_viewers(uuid) from anon;
grant execute on function public.me_can_manage_client_viewers(uuid) to authenticated, service_role;
revoke all on function public.me_can_manage_firm_viewers(uuid) from public;
revoke all on function public.me_can_manage_firm_viewers(uuid) from anon;
grant execute on function public.me_can_manage_firm_viewers(uuid) to authenticated, service_role;