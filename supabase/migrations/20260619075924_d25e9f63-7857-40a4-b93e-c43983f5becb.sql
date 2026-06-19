CREATE TABLE public.client_true_breakeven_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  loan_principal numeric NOT NULL DEFAULT 0,
  credit_card_interest numeric NOT NULL DEFAULT 0,
  owner_drawings numeric NOT NULL DEFAULT 0,
  tax_payments numeric,
  ato_payment_plan numeric NOT NULL DEFAULT 0,
  equipment_finance numeric NOT NULL DEFAULT 0,
  other numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, tenant_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_true_breakeven_inputs TO authenticated;
GRANT ALL ON public.client_true_breakeven_inputs TO service_role;

ALTER TABLE public.client_true_breakeven_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers read true breakeven inputs"
  ON public.client_true_breakeven_inputs
  FOR SELECT
  USING (app_private.has_client_access(auth.uid(), client_id));

CREATE POLICY "Manage true breakeven inputs by firm"
  ON public.client_true_breakeven_inputs
  FOR ALL
  USING (app_private.user_can_manage_client(auth.uid(), client_id))
  WITH CHECK (app_private.user_can_manage_client(auth.uid(), client_id));

CREATE TRIGGER trg_client_true_breakeven_inputs_updated_at
  BEFORE UPDATE ON public.client_true_breakeven_inputs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_client_true_breakeven_inputs_lookup
  ON public.client_true_breakeven_inputs (client_id, tenant_id);