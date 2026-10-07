-- Client overview, Batch 4: shared acknowledge / snooze for feed alerts.
-- One state per client + event key, shared by everyone who can see that
-- client. Read with the existing client read predicate; written ONLY through
-- public.set_overview_alert_state (aal2, write predicate, audited).

create table public.overview_alert_states (
  id uuid not null default gen_random_uuid() primary key,
  client_id uuid not null references public.clients(id) on delete cascade,
  event_key text not null check (char_length(event_key) between 1 and 120),
  severity_at_ack smallint not null default 0,
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  snoozed_by uuid references auth.users(id) on delete set null,
  snoozed_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, event_key)
);

revoke all on public.overview_alert_states from anon, authenticated, public;
grant select on public.overview_alert_states to authenticated;
grant all on public.overview_alert_states to service_role;

alter table public.overview_alert_states enable row level security;

create policy mfa_aal2_required on public.overview_alert_states
  as restrictive for all to authenticated
  using (app_private.is_aal2()) with check (app_private.is_aal2());

create policy "readers of a client read its alert states" on public.overview_alert_states
  for select to authenticated
  using (app_private.user_can_read_client(auth.uid(), client_id));

create trigger set_overview_alert_states_updated_at
  before update on public.overview_alert_states
  for each row execute function public.tg_set_updated_at();

create or replace function public.set_overview_alert_state(
  _client_id uuid,
  _event_key text,
  _action text,
  _severity smallint default 0,
  _snooze_until timestamptz default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _uid uuid := auth.uid();
  _firm uuid;
begin
  perform app_private.assert_aal2();
  -- Write predicate only (PK invariant 11): never a read predicate.
  if _uid is null or not app_private.user_can_write_client(_uid, _client_id) then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;
  if _event_key is null or char_length(_event_key) not between 1 and 120 then
    raise exception 'INVALID_EVENT' using errcode = 'invalid_parameter_value';
  end if;
  if _action not in ('acknowledge', 'snooze', 'clear') then
    raise exception 'INVALID_ACTION' using errcode = 'invalid_parameter_value';
  end if;
  if _action = 'snooze' and (_snooze_until is null or _snooze_until <= now()
                             or _snooze_until > now() + interval '90 days') then
    raise exception 'INVALID_SNOOZE' using errcode = 'invalid_parameter_value';
  end if;

  select c.firm_id into _firm from public.clients c where c.id = _client_id;

  if _action = 'clear' then
    delete from public.overview_alert_states where client_id = _client_id and event_key = _event_key;
  elsif _action = 'acknowledge' then
    insert into public.overview_alert_states (client_id, event_key, severity_at_ack, acknowledged_by, acknowledged_at)
    values (_client_id, _event_key, coalesce(_severity, 0), _uid, now())
    on conflict (client_id, event_key) do update
      set severity_at_ack = excluded.severity_at_ack,
          acknowledged_by = excluded.acknowledged_by,
          acknowledged_at = excluded.acknowledged_at;
  else
    insert into public.overview_alert_states (client_id, event_key, severity_at_ack, snoozed_by, snoozed_at, snoozed_until)
    values (_client_id, _event_key, coalesce(_severity, 0), _uid, now(), _snooze_until)
    on conflict (client_id, event_key) do update
      set severity_at_ack = excluded.severity_at_ack,
          snoozed_by = excluded.snoozed_by,
          snoozed_at = excluded.snoozed_at,
          snoozed_until = excluded.snoozed_until;
  end if;

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (_uid, _firm, 'overview_alert_' || _action, 'client', _client_id::text,
          jsonb_build_object('event_key', _event_key, 'severity', _severity, 'snooze_until', _snooze_until));
end;
$$;

revoke execute on function public.set_overview_alert_state(uuid, text, text, smallint, timestamptz) from public, anon;
grant execute on function public.set_overview_alert_state(uuid, text, text, smallint, timestamptz) to authenticated, service_role;