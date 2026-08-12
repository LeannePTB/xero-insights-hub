CREATE TABLE IF NOT EXISTS public.scenario_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  xero_invoice_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, xero_invoice_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenario_exclusions TO authenticated;
GRANT ALL ON public.scenario_exclusions TO service_role;

ALTER TABLE public.scenario_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client members manage scenario exclusions"
ON public.scenario_exclusions
FOR ALL
TO authenticated
USING (app_private.has_client_access(auth.uid(), client_id))
WITH CHECK (app_private.has_client_access(auth.uid(), client_id));

DROP TABLE IF EXISTS public.scenario_invoices;
DROP TABLE IF EXISTS public.scenario_expenses;
DROP TABLE IF EXISTS public.scenario_customers;
DROP TABLE IF EXISTS public.scenario_settings;