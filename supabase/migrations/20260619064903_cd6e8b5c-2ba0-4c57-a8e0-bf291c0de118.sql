
CREATE TABLE public.client_cost_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  account_name text NOT NULL,
  classification text NOT NULL CHECK (classification IN ('fixed','variable')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, tenant_id, account_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_cost_classifications TO authenticated;
GRANT ALL ON public.client_cost_classifications TO service_role;

ALTER TABLE public.client_cost_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers read cost classifications"
  ON public.client_cost_classifications
  FOR SELECT
  USING (app_private.has_client_access(auth.uid(), client_id));

CREATE POLICY "Manage cost classifications by firm"
  ON public.client_cost_classifications
  FOR ALL
  USING (app_private.user_can_manage_client(auth.uid(), client_id))
  WITH CHECK (app_private.user_can_manage_client(auth.uid(), client_id));

CREATE TRIGGER trg_client_cost_classifications_updated_at
  BEFORE UPDATE ON public.client_cost_classifications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_client_cost_classifications_lookup
  ON public.client_cost_classifications (client_id, tenant_id);
