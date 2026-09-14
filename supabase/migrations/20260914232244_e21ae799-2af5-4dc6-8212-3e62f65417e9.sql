create or replace function app_private.assert_xero_connection_firm_match()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_conn uuid;
  v_bad integer;
begin
  -- Each NEW field reference must sit in its own branch: plpgsql plans a
  -- single CASE expression as one statement, so a reference to a column the
  -- firing table does not have fails with 42703 even on the unused branch.
  if TG_TABLE_NAME = 'client_xero_orgs' then
    v_conn := NEW.xero_connection_id;
  else
    v_conn := NEW.id;
  end if;

  select count(*) into v_bad
  from public.client_xero_orgs l
  join public.clients c on c.id = l.client_id
  join public.xero_connections x on x.id = l.xero_connection_id
  where l.xero_connection_id = v_conn
    and c.firm_id is distinct from x.firm_id;

  if v_bad > 0 then
    raise exception 'A Xero file must belong to the same organisation as the client it is linked to';
  end if;

  return null;
end;
$$;

revoke all on function app_private.assert_xero_connection_firm_match() from public;