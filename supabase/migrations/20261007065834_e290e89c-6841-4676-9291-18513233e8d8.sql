-- Move the privileged body into app_private (not exposed through the API) and
-- keep a SECURITY INVOKER public wrapper. Same checks, same audit row.

alter function public.set_overview_alert_state(uuid, text, text, smallint, timestamptz)
  set schema app_private;

revoke execute on function app_private.set_overview_alert_state(uuid, text, text, smallint, timestamptz) from public, anon;
grant execute on function app_private.set_overview_alert_state(uuid, text, text, smallint, timestamptz) to authenticated, service_role;

create or replace function public.set_overview_alert_state(
  _client_id uuid,
  _event_key text,
  _action text,
  _severity smallint default 0,
  _snooze_until timestamptz default null
)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  perform app_private.assert_aal2();
  perform app_private.set_overview_alert_state(_client_id, _event_key, _action, _severity, _snooze_until);
end;
$$;

revoke execute on function public.set_overview_alert_state(uuid, text, text, smallint, timestamptz) from public, anon;
grant execute on function public.set_overview_alert_state(uuid, text, text, smallint, timestamptz) to authenticated, service_role;