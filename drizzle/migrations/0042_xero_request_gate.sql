-- Shared Xero request gate: cross-instance per-file concurrency slots, pacing
-- and Retry-After backoff. Operational telemetry only (no client data).
create table public.xero_gate_slots (
  tenant_id text not null,
  slot int not null,
  holder uuid not null,
  expires_at timestamptz not null,
  primary key (tenant_id, slot)
);
create table public.xero_gate_state (
  tenant_id text primary key,
  paused_until timestamptz,
  minute_start timestamptz not null default now(),
  minute_count int not null default 0,
  last_wait_at timestamptz,
  waits_day date,
  waits_count int not null default 0,
  updated_at timestamptz not null default now()
);
revoke all on public.xero_gate_slots from anon, authenticated, public;
revoke all on public.xero_gate_state from anon, authenticated, public;
grant all on public.xero_gate_slots to service_role;
grant all on public.xero_gate_state to service_role;
alter table public.xero_gate_slots enable row level security;
alter table public.xero_gate_state enable row level security;
-- No policies: service role (system gate) only.

create or replace function public.xero_gate_acquire(_tenant_id text, _cap int, _per_minute int, _lease_seconds int)
returns uuid language plpgsql security definer set search_path = public as $$
declare st public.xero_gate_state; h uuid := gen_random_uuid(); i int; got boolean := false;
begin
  if _tenant_id is null or _cap < 1 or _cap > 5 or _per_minute < 1 or _per_minute > 60 or _lease_seconds < 1 or _lease_seconds > 120 then
    raise exception 'invalid gate arguments';
  end if;
  insert into public.xero_gate_state(tenant_id) values (_tenant_id) on conflict do nothing;
  select * into st from public.xero_gate_state where tenant_id = _tenant_id for update;
  delete from public.xero_gate_slots where tenant_id = _tenant_id and expires_at < now();
  if st.minute_start < now() - interval '60 seconds' then
    st.minute_start := now(); st.minute_count := 0;
  end if;
  if (st.paused_until is null or st.paused_until <= now()) and st.minute_count < _per_minute then
    for i in 1.._cap loop
      insert into public.xero_gate_slots(tenant_id, slot, holder, expires_at)
        values (_tenant_id, i, h, now() + make_interval(secs => _lease_seconds))
        on conflict do nothing;
      if found then got := true; exit; end if;
    end loop;
  end if;
  if got then
    update public.xero_gate_state set minute_start = st.minute_start, minute_count = st.minute_count + 1, updated_at = now() where tenant_id = _tenant_id;
    return h;
  end if;
  update public.xero_gate_state set minute_start = st.minute_start, minute_count = st.minute_count,
    last_wait_at = now(),
    waits_count = case when waits_day = (now() at time zone 'utc')::date then waits_count + 1 else 1 end,
    waits_day = (now() at time zone 'utc')::date, updated_at = now()
  where tenant_id = _tenant_id;
  return null;
end $$;

create or replace function public.xero_gate_release(_holder uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.xero_gate_slots where holder = _holder;
$$;

create or replace function public.xero_gate_backoff(_tenant_id text, _seconds int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _tenant_id is null or _seconds < 1 then return; end if;
  insert into public.xero_gate_state(tenant_id, paused_until) values (_tenant_id, now() + make_interval(secs => least(_seconds, 120)))
  on conflict (tenant_id) do update set paused_until = greatest(coalesce(xero_gate_state.paused_until, now()), excluded.paused_until), updated_at = now();
end $$;

revoke execute on function public.xero_gate_acquire(text,int,int,int) from public, anon, authenticated;
revoke execute on function public.xero_gate_release(uuid) from public, anon, authenticated;
revoke execute on function public.xero_gate_backoff(text,int) from public, anon, authenticated;
grant execute on function public.xero_gate_acquire(text,int,int,int) to service_role;
grant execute on function public.xero_gate_release(uuid) to service_role;
grant execute on function public.xero_gate_backoff(text,int) to service_role;

-- System Administrator monitoring reader (Path C metadata).
create or replace function public.xero_gate_status()
returns table(tenant_id text, tenant_name text, in_flight int, waiting_now boolean, last_wait_at timestamptz, waits_today int, paused_until timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  return query
    select s.tenant_id,
      (select r.tenant_name from public.xero_rate_limits r where r.tenant_id = s.tenant_id order by r.day desc limit 1),
      (select count(*)::int from public.xero_gate_slots g where g.tenant_id = s.tenant_id and g.expires_at > now()),
      (s.last_wait_at > now() - interval '2 minutes' or s.paused_until > now()),
      s.last_wait_at,
      case when s.waits_day = (now() at time zone 'utc')::date then s.waits_count else 0 end,
      s.paused_until
    from public.xero_gate_state s
    where s.updated_at > now() - interval '1 day';
end $$;
revoke execute on function public.xero_gate_status() from public, anon;
grant execute on function public.xero_gate_status() to authenticated;