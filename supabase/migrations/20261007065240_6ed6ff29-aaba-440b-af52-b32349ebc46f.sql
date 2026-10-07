-- Client overview, Batch 3: nightly key figures, one row per client per Xero
-- file per Sydney day. Numeric figures only. Written only by the scheduled
-- refresh (service role); read with the same dual check as xero_snapshots.

create table public.client_key_figures (
  id uuid not null default gen_random_uuid() primary key,
  client_id uuid not null references public.clients(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  tenant_id text not null,
  as_at date not null,
  cash numeric,
  debtors_total numeric,
  debtors_overdue numeric,
  creditors numeric,
  protected_money numeric,
  revenue_mtd numeric,
  net_profit_mtd numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, tenant_id, as_at)
);

create index client_key_figures_client_date_idx on public.client_key_figures (client_id, as_at desc);

revoke all on public.client_key_figures from anon, authenticated, public;
grant select on public.client_key_figures to authenticated;
grant all on public.client_key_figures to service_role;

alter table public.client_key_figures enable row level security;

create policy mfa_aal2_required on public.client_key_figures
  as restrictive for all to authenticated
  using (app_private.is_aal2()) with check (app_private.is_aal2());

create policy "entitled users read client key figures" on public.client_key_figures
  for select to authenticated
  using (
    public.user_can_access_client(auth.uid(), client_id)
    and app_private.user_can_access_tenant(auth.uid(), tenant_id)
  );

create trigger update_client_key_figures_updated_at
  before update on public.client_key_figures
  for each row execute function public.tg_set_updated_at();