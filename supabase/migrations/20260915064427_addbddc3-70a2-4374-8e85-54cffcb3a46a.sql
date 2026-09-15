-- Batch 4 support: two read-only helpers the app needs so no TypeScript has to
-- re-implement a database rule (invariant 6). Both aal2-guarded, caller-scoped,
-- revoked from PUBLIC and anon. Neither reads client data.

create or replace function public.card_model_active()
returns text
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  return case when app_private.setting_bool('card_model_v2') then 'v2' else 'v1' end;
end;
$$;

revoke all on function public.card_model_active() from public;
revoke all on function public.card_model_active() from anon;

-- The cards the organisation's purchase makes available for this client, before
-- the client's own ticks. Same access rule as client_visible_cards.
create or replace function public.client_available_cards(_client_id uuid)
returns text[]
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();

  if not app_private.user_can_read_client(auth.uid(), _client_id) then
    raise exception 'CLIENT_ACCESS_DENIED';
  end if;

  return app_private.client_available_cards(_client_id);
end;
$$;

revoke all on function public.client_available_cards(uuid) from public;
revoke all on function public.client_available_cards(uuid) from anon;