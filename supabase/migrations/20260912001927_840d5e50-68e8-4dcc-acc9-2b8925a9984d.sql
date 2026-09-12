-- Phase 5 step 5: a Xero connection can never exist without an organisation.
-- Verified read-only before applying: 12 rows, 0 with a null firm_id, 0 whose
-- linked client belongs to a different organisation. No row is modified here.

alter table public.xero_connections alter column firm_id set not null;

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
  v_conn := case TG_TABLE_NAME
              when 'client_xero_orgs' then NEW.xero_connection_id
              else NEW.id
            end;

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

create constraint trigger client_xero_orgs_firm_match
  after insert or update on public.client_xero_orgs
  deferrable initially deferred
  for each row execute function app_private.assert_xero_connection_firm_match();

create constraint trigger xero_connections_firm_match
  after update of firm_id on public.xero_connections
  deferrable initially deferred
  for each row execute function app_private.assert_xero_connection_firm_match();