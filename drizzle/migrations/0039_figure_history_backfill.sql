-- Month-end figure history backfilled from Xero (owner decision 14 Oct 2026).
-- Separate from client_key_figures so a real nightly row is never overwritten.
create table public.client_figure_history (
  id uuid not null default gen_random_uuid() primary key,
  client_id uuid not null references public.clients(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  tenant_id text not null,
  month_end date not null,
  cash numeric,
  net_profit numeric,
  source text not null default 'xero_backfill' check (source = 'xero_backfill'),
  fetched_at timestamptz not null default now(),
  unique (client_id, tenant_id, month_end)
);
create index client_figure_history_client_idx on public.client_figure_history (client_id, month_end);
revoke all on public.client_figure_history from anon, authenticated, public;
grant select on public.client_figure_history to authenticated;
grant all on public.client_figure_history to service_role;
alter table public.client_figure_history enable row level security;
create policy mfa_aal2_required on public.client_figure_history
  as restrictive for all to authenticated
  using (app_private.is_aal2()) with check (app_private.is_aal2());
create policy "entitled users read client figure history" on public.client_figure_history
  for select to authenticated
  using (
    public.user_can_access_client(auth.uid(), client_id)
    and app_private.user_can_access_tenant(auth.uid(), tenant_id)
  );

-- Backfill job queue: metadata only, never figures. No authenticated grant;
-- read only through public.figure_backfill_status().
create table public.figure_backfill_runs (
  id uuid not null default gen_random_uuid() primary key,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  firm_id uuid references public.firms(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','done')),
  finished_at timestamptz
);
create table public.figure_backfill_items (
  id uuid not null default gen_random_uuid() primary key,
  run_id uuid not null references public.figure_backfill_runs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  tenant_id text,
  status text not null default 'pending' check (status in ('pending','done','skipped','failed')),
  months_cash int not null default 0,
  months_profit int not null default 0,
  attempts int not null default 0,
  reason text check (char_length(reason) <= 200),
  next_attempt_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index figure_backfill_items_pending_idx on public.figure_backfill_items (status, next_attempt_at);
revoke all on public.figure_backfill_runs from anon, authenticated, public;
revoke all on public.figure_backfill_items from anon, authenticated, public;
grant all on public.figure_backfill_runs to service_role;
grant all on public.figure_backfill_items to service_role;
alter table public.figure_backfill_runs enable row level security;
alter table public.figure_backfill_items enable row level security;
create policy mfa_aal2_required on public.figure_backfill_runs
  as restrictive for all to authenticated
  using (app_private.is_aal2()) with check (app_private.is_aal2());
create policy mfa_aal2_required on public.figure_backfill_items
  as restrictive for all to authenticated
  using (app_private.is_aal2()) with check (app_private.is_aal2());

-- Trigger: System Administrator at aal2 only. Queues work; holds no figures.
create or replace function public.start_figure_backfill(_firm_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare _run uuid; _n int; _skipped int;
begin
  perform public.assert_super_admin();
  if exists (select 1 from public.figure_backfill_runs where status in ('queued','running')) then
    raise exception 'BACKFILL_ALREADY_RUNNING' using errcode = 'check_violation';
  end if;
  insert into public.figure_backfill_runs (requested_by, firm_id) values (auth.uid(), _firm_id) returning id into _run;
  insert into public.figure_backfill_items (run_id, client_id, firm_id, tenant_id, status, reason)
  select distinct on (c.id, xc.tenant_id) _run, c.id, c.firm_id, xc.tenant_id,
         case when xc.status = 'connected' then 'pending' else 'skipped' end,
         case when xc.status = 'connected' then null else 'Xero file is not connected' end
    from public.clients c
    join public.client_xero_orgs cx on cx.client_id = c.id
    join public.xero_connections xc on xc.id = cx.xero_connection_id
   where _firm_id is null or c.firm_id = _firm_id;
  insert into public.figure_backfill_items (run_id, client_id, firm_id, status, reason)
  select _run, c.id, c.firm_id, 'skipped', 'No Xero file linked'
    from public.clients c
   where (_firm_id is null or c.firm_id = _firm_id)
     and not exists (select 1 from public.client_xero_orgs cx where cx.client_id = c.id);
  select count(*) filter (where status = 'pending'), count(*) filter (where status = 'skipped')
    into _n, _skipped from public.figure_backfill_items where run_id = _run;
  if _n = 0 then update public.figure_backfill_runs set status = 'done', finished_at = now() where id = _run; end if;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'figure_backfill_started', 'figure_backfill_run', _run::text,
          jsonb_build_object('firm_id', _firm_id, 'files', _n, 'skipped', _skipped));
  return _run;
end;
$$;
revoke execute on function public.start_figure_backfill(uuid) from public, anon;
grant execute on function public.start_figure_backfill(uuid) to authenticated;

-- Progress: latest run, per client/file status and month counts. Metadata only.
create or replace function public.figure_backfill_status()
returns table (run_id uuid, run_status text, requested_at timestamptz, finished_at timestamptz,
               organisation text, client text, file text, status text,
               months_cash int, months_profit int, reason text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  perform public.assert_super_admin();
  return query
  with r as (select * from public.figure_backfill_runs order by requested_at desc limit 1)
  select r.id, r.status, r.requested_at, r.finished_at, f.name, c.name,
         coalesce(xc.tenant_name, i.tenant_id), i.status, i.months_cash, i.months_profit, i.reason, i.updated_at
    from r
    left join public.figure_backfill_items i on i.run_id = r.id
    left join public.clients c on c.id = i.client_id
    left join public.firms f on f.id = i.firm_id
    left join lateral (select x.tenant_name from public.xero_connections x where x.tenant_id = i.tenant_id limit 1) xc on true
   order by f.name, c.name;
end;
$$;
revoke execute on function public.figure_backfill_status() from public, anon;
grant execute on function public.figure_backfill_status() to authenticated;
