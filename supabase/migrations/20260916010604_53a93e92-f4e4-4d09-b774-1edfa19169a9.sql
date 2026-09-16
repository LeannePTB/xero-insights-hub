ALTER TABLE public.xero_connections
  ADD COLUMN payroll_access_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN payroll_access_checked_at timestamp with time zone,
  ADD COLUMN payroll_access_http_status integer;

ALTER TABLE public.xero_connections
  ADD CONSTRAINT xero_connections_payroll_access_status_check
  CHECK (payroll_access_status IN ('unknown', 'available', 'unavailable'));

ALTER TABLE public.xero_connections
  ADD CONSTRAINT xero_connections_payroll_access_http_status_check
  CHECK (payroll_access_http_status IS NULL OR payroll_access_http_status IN (401, 403));

COMMENT ON COLUMN public.xero_connections.payroll_access_status IS
  'Non-sensitive Payroll API availability. Does not change the accounting connection status.';
COMMENT ON COLUMN public.xero_connections.payroll_access_checked_at IS
  'When Payroll API availability was last confirmed or refused.';
COMMENT ON COLUMN public.xero_connections.payroll_access_http_status IS
  'Last definitive Payroll API refusal status (401/403), otherwise null.';