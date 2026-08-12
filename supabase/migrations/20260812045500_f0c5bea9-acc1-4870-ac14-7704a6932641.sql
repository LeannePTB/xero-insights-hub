CREATE TABLE public.scenario_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  xero_contact_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scenario_customers_client_idx ON public.scenario_customers(client_id);
CREATE UNIQUE INDEX scenario_customers_client_name_idx ON public.scenario_customers(client_id, lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenario_customers TO authenticated;
GRANT ALL ON public.scenario_customers TO service_role;
ALTER TABLE public.scenario_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scenario customers by client access" ON public.scenario_customers FOR ALL TO authenticated
  USING (app_private.has_client_access(auth.uid(), client_id))
  WITH CHECK (app_private.has_client_access(auth.uid(), client_id));
CREATE TRIGGER scenario_customers_set_updated_at BEFORE UPDATE ON public.scenario_customers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.scenario_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.scenario_customers(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  issue_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'Pending',
  excluded boolean NOT NULL DEFAULT false,
  xero_invoice_id text,
  xero_tenant_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scenario_invoices_client_idx ON public.scenario_invoices(client_id);
CREATE UNIQUE INDEX scenario_invoices_xero_idx ON public.scenario_invoices(client_id, xero_invoice_id) WHERE xero_invoice_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenario_invoices TO authenticated;
GRANT ALL ON public.scenario_invoices TO service_role;
ALTER TABLE public.scenario_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scenario invoices by client access" ON public.scenario_invoices FOR ALL TO authenticated
  USING (app_private.has_client_access(auth.uid(), client_id))
  WITH CHECK (app_private.has_client_access(auth.uid(), client_id));
CREATE TRIGGER scenario_invoices_set_updated_at BEFORE UPDATE ON public.scenario_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.scenario_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'Fixed',
  category text NOT NULL DEFAULT 'General',
  date date NOT NULL DEFAULT current_date,
  recurring_monthly boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scenario_expenses_client_idx ON public.scenario_expenses(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenario_expenses TO authenticated;
GRANT ALL ON public.scenario_expenses TO service_role;
ALTER TABLE public.scenario_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scenario expenses by client access" ON public.scenario_expenses FOR ALL TO authenticated
  USING (app_private.has_client_access(auth.uid(), client_id))
  WITH CHECK (app_private.has_client_access(auth.uid(), client_id));
CREATE TRIGGER scenario_expenses_set_updated_at BEFORE UPDATE ON public.scenario_expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.scenario_settings (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'AUD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenario_settings TO authenticated;
GRANT ALL ON public.scenario_settings TO service_role;
ALTER TABLE public.scenario_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scenario settings by client access" ON public.scenario_settings FOR ALL TO authenticated
  USING (app_private.has_client_access(auth.uid(), client_id))
  WITH CHECK (app_private.has_client_access(auth.uid(), client_id));
CREATE TRIGGER scenario_settings_set_updated_at BEFORE UPDATE ON public.scenario_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();