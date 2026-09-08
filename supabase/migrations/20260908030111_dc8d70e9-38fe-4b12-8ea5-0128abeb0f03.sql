CREATE OR REPLACE FUNCTION public.xero_required_scopes()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY[
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
    'assets.read'
  ]::text[];
$$;