create or replace function public.assert_client_write_access(_client_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'app_private'
as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.clients c
     where c.id = _client_id
       and (c.owner_user_id = _uid
            or (c.firm_id is not null and app_private.has_firm_access(_uid, c.firm_id)))
  ) then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke execute on function public.assert_client_write_access(uuid) from public, anon;
grant execute on function public.assert_client_write_access(uuid) to authenticated;

create or replace function public.delete_statement_upload(_upload_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'app_private'
as $$
declare _uid uuid := auth.uid(); _client_id uuid; _firm_id uuid;
begin
  if _uid is null then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;
  select u.client_id into _client_id from public.unreconciled_uploads u where u.id = _upload_id;
  if _client_id is null then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;
  perform public.assert_client_write_access(_client_id);
  select c.firm_id into _firm_id from public.clients c where c.id = _client_id;

  delete from public.unreconciled_uploads where id = _upload_id;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (_uid, _firm_id, 'statement_upload_deleted', 'unreconciled_uploads', _upload_id::text,
          jsonb_build_object('client_id', _client_id));
end;
$$;

revoke execute on function public.delete_statement_upload(uuid) from public, anon;
grant execute on function public.delete_statement_upload(uuid) to authenticated;