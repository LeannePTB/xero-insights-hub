-- Path D: standing viewer grant (read-only, organisation-wide).

create table public.firm_viewer_access (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tier public.dashboard_tier not null default 'basic',
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, user_id)
);

create index firm_viewer_access_user_idx on public.firm_viewer_access(user_id);

revoke all on table public.firm_viewer_access from anon, authenticated;
grant select, insert, update, delete on public.firm_viewer_access to authenticated;
grant all on public.firm_viewer_access to service_role;

alter table public.firm_viewer_access enable row level security;

create table if not exists public.practice_team (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
revoke all on table public.practice_team from anon, authenticated;
grant select on public.practice_team to authenticated;
grant all on public.practice_team to service_role;
alter table public.practice_team enable row level security;

create policy "practice team readable by super admin" on public.practice_team
  for select to authenticated using (app_private.is_super_admin(auth.uid()));
create policy "mfa_aal2_required" on public.practice_team
  as restrictive for all to authenticated
  using (app_private.is_aal2()) with check (app_private.is_aal2());

-- "Active Positive Traction member of THAT organisation": an active firm_members
-- row for this organisation held by someone on the practice team. Never a bare
-- super admin, never a practice-team member of another organisation.
create or replace function app_private.is_practice_member_of(_user_id uuid, _firm_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1
    from public.firm_members fm
    join public.practice_team pt on pt.user_id = fm.user_id
    where fm.firm_id = _firm_id
      and fm.user_id = _user_id
      and fm.status = 'active'
  )
$$;

-- Who may manage viewer grants for a client's organisation.
create or replace function app_private.can_manage_client_viewers(_user_id uuid, _firm_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
    _firm_id is not null
    and (
      app_private.is_org_owner(_user_id, _firm_id)
      or app_private.is_practice_member_of(_user_id, _firm_id)
    )
  ) end
$$;

create policy "owners manage standing viewer grants (select)" on public.firm_viewer_access
  for select to authenticated
  using (app_private.can_manage_client_viewers(auth.uid(), firm_id) or user_id = auth.uid());
create policy "owners manage standing viewer grants (insert)" on public.firm_viewer_access
  for insert to authenticated
  with check (app_private.can_manage_client_viewers(auth.uid(), firm_id));
create policy "owners manage standing viewer grants (update)" on public.firm_viewer_access
  for update to authenticated
  using (app_private.can_manage_client_viewers(auth.uid(), firm_id))
  with check (app_private.can_manage_client_viewers(auth.uid(), firm_id));
create policy "owners manage standing viewer grants (delete)" on public.firm_viewer_access
  for delete to authenticated
  using (app_private.can_manage_client_viewers(auth.uid(), firm_id));
create policy "mfa_aal2_required" on public.firm_viewer_access
  as restrictive for all to authenticated
  using (app_private.is_aal2()) with check (app_private.is_aal2());

create trigger firm_viewer_access_set_updated_at
  before update on public.firm_viewer_access
  for each row execute function public.tg_set_updated_at();

-- READ predicates. The standing grant exists ONLY inside these two functions.
create or replace function app_private.has_standing_client_access(_user_id uuid, _client_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
    exists (
      select 1
      from public.clients c
      join public.firm_viewer_access fva
        on fva.firm_id = c.firm_id and fva.user_id = _user_id
      where c.id = _client_id and c.firm_id is not null
    )
  ) end
$$;

create or replace function app_private.has_client_read_access(_user_id uuid, _client_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select app_private.has_client_access(_user_id, _client_id)
      or app_private.has_standing_client_access(_user_id, _client_id)
$$;

revoke execute on function app_private.is_practice_member_of(uuid, uuid) from public, anon;
revoke execute on function app_private.can_manage_client_viewers(uuid, uuid) from public, anon;
revoke execute on function app_private.has_standing_client_access(uuid, uuid) from public, anon;
revoke execute on function app_private.has_client_read_access(uuid, uuid) from public, anon;
grant execute on function app_private.is_practice_member_of(uuid, uuid) to authenticated, service_role;
grant execute on function app_private.can_manage_client_viewers(uuid, uuid) to authenticated, service_role;
grant execute on function app_private.has_standing_client_access(uuid, uuid) to authenticated, service_role;
grant execute on function app_private.has_client_read_access(uuid, uuid) to authenticated, service_role;

-- The only change to the client read check.
create or replace function app_private.user_can_read_client(_user_id uuid, _client_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
  SELECT app_private.user_can_manage_client(_user_id, _client_id)
      OR app_private.has_client_read_access(_user_id, _client_id)
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = _client_id
          AND c.firm_id IS NOT NULL
          AND app_private.has_firm_access(_user_id, c.firm_id)
      )
  ) end
$$;

-- Viewer SELECT policies move to the read predicate. Write policies
-- (scenario_exclusions, unreconciled_lines update) deliberately do NOT.
drop policy "viewers read assigned clients" on public.clients;
create policy "viewers read assigned clients" on public.clients
  for select to authenticated using (app_private.has_client_read_access(auth.uid(), id));

drop policy "Client viewers read notes" on public.client_notes;
create policy "Client viewers read notes" on public.client_notes
  for select to authenticated using (app_private.has_client_read_access(auth.uid(), client_id));

drop policy "Viewers read cost classifications" on public.client_cost_classifications;
create policy "Viewers read cost classifications" on public.client_cost_classifications
  for select to authenticated using (app_private.has_client_read_access(auth.uid(), client_id));

drop policy "Viewers read statutory accounts" on public.client_statutory_accounts;
create policy "Viewers read statutory accounts" on public.client_statutory_accounts
  for select to authenticated using (app_private.has_client_read_access(auth.uid(), client_id));

drop policy "Viewers read true breakeven inputs" on public.client_true_breakeven_inputs;
create policy "Viewers read true breakeven inputs" on public.client_true_breakeven_inputs
  for select to authenticated using (app_private.has_client_read_access(auth.uid(), client_id));

drop policy "viewers read assigned client xero orgs" on public.client_xero_orgs;
create policy "viewers read assigned client xero orgs" on public.client_xero_orgs
  for select to authenticated using (app_private.has_client_read_access(auth.uid(), client_id));

drop policy "client viewers read their finalised reports" on public.client_reports;
create policy "client viewers read their finalised reports" on public.client_reports
  for select to authenticated
  using (app_private.has_client_read_access(auth.uid(), client_id)
         and status = any (array['final','sent']));

drop policy "viewers read loan accounts for their client" on public.loan_consolidation_accounts;
create policy "viewers read loan accounts for their client" on public.loan_consolidation_accounts
  for select to authenticated using (app_private.has_client_read_access(auth.uid(), client_id));

drop policy "read reconciliation snapshots for accessible clients" on public.reconciliation_snapshots;
create policy "read reconciliation snapshots for accessible clients" on public.reconciliation_snapshots
  for select to authenticated
  using (app_private.user_can_manage_client(auth.uid(), client_id)
         or app_private.has_client_read_access(auth.uid(), client_id));

drop policy "Viewers can read lines for their client" on public.unreconciled_lines;
create policy "Viewers can read lines for their client" on public.unreconciled_lines
  for select to authenticated using (app_private.has_client_read_access(auth.uid(), client_id));

drop policy "Viewers can read uploads for their client" on public.unreconciled_uploads;
create policy "Viewers can read uploads for their client" on public.unreconciled_uploads
  for select to authenticated using (app_private.has_client_read_access(auth.uid(), client_id));

drop policy "Viewers read accessible tier widget config" on public.tier_widget_config;
create policy "Viewers read accessible tier widget config" on public.tier_widget_config
  for select to authenticated
  using (auth.uid() is not null
         and (client_id is null or app_private.has_client_read_access(auth.uid(), client_id)));

-- Level resolution: specific grant wins, then standing, then capped by the
-- client's own entitlement.
create or replace function app_private.viewer_tier(_user_id uuid, _client_id uuid)
returns public.dashboard_tier language plpgsql stable security definer set search_path to 'public' as $$
declare _t public.dashboard_tier; _cap public.dashboard_tier;
begin
  if auth.uid() is not null and _user_id is distinct from auth.uid() then return null; end if;

  select ca.tier::public.dashboard_tier into _t
  from public.client_access ca
  where ca.client_id = _client_id and ca.user_id = _user_id;

  if _t is null then
    select fva.tier into _t
    from public.clients c
    join public.firm_viewer_access fva
      on fva.firm_id = c.firm_id and fva.user_id = _user_id
    where c.id = _client_id;
  end if;

  if _t is null then return null; end if;

  select e.tier into _cap from public.client_entitlement(_client_id) e;
  if _cap is null then return 'basic'::public.dashboard_tier; end if;
  return least(_t, _cap);
end;
$$;
revoke execute on function app_private.viewer_tier(uuid, uuid) from public, anon;
grant execute on function app_private.viewer_tier(uuid, uuid) to authenticated, service_role;

-- Widget access sees the standing grant's level too.
create or replace function public.client_access_tiers(_client_id uuid)
returns setof text language plpgsql stable security definer set search_path to 'public' as $$
begin
  if auth.uid() is not null then
    perform app_private.assert_aal2();
    if not app_private.user_can_read_client(auth.uid(), _client_id) then
      raise exception 'You cannot view this client.';
    end if;
  end if;
  return query
    select ca.tier::text from public.client_access ca where ca.client_id = _client_id
    union
    select fva.tier::text
    from public.clients c
    join public.firm_viewer_access fva on fva.firm_id = c.firm_id
    where c.id = _client_id;
end;
$$;