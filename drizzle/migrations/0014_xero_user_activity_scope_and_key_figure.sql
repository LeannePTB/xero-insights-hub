-- Last Xero login per file: new read-only Finance API scope + stored key figure.
-- 1. Add finance.accountingactivity.read to the required read-only scope list.
--    xero_missing_scopes() will flag connected files until re-authorised; the
--    refresh skips files that have not granted it (no failing retries).
create or replace function public.xero_required_scopes()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select array[
    'offline_access',
    'accounting.settings.read',
    'accounting.contacts.read',
    'accounting.invoices.read',
    'accounting.payments.read',
    'accounting.banktransactions.read',
    'accounting.manualjournals.read',
    'accounting.reports.balancesheet.read',
    'accounting.reports.banksummary.read',
    'accounting.reports.profitandloss.read',
    'accounting.reports.trialbalance.read',
    'accounting.reports.aged.read',
    'accounting.reports.taxreports.read',
    'assets.read',
    'payroll.employees.read',
    'payroll.payruns.read',
    'payroll.payslip.read',
    'payroll.settings.read',
    'finance.accountingactivity.read'
  ]
$$;

-- 2. Nightly key figures gain the most recent login by anyone in the file.
alter table public.client_key_figures
  add column if not exists last_xero_login_at timestamptz;