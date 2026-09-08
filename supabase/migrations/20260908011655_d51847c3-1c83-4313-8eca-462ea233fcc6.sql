CREATE TYPE public.statutory_category AS ENUM ('gst', 'payg', 'super', 'none');

CREATE TABLE public.client_statutory_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  account_name text NOT NULL,
  category public.statutory_category NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, tenant_id, account_name)
);

COMMENT ON TABLE public.client_statutory_accounts IS
  'Per-client override of which Balance Sheet accounts hold GST, PAYG withholding or superannuation. A stored row always wins over name matching in classifyTaxLine; an absent row means name matching applies. Never backfilled.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_statutory_accounts TO authenticated;
GRANT ALL ON public.client_statutory_accounts TO service_role;

ALTER TABLE public.client_statutory_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage statutory accounts by firm"
  ON public.client_statutory_accounts
  FOR ALL
  TO authenticated
  USING (app_private.user_can_manage_client(auth.uid(), client_id))
  WITH CHECK (app_private.user_can_manage_client(auth.uid(), client_id));

CREATE POLICY "Viewers read statutory accounts"
  ON public.client_statutory_accounts
  FOR SELECT
  TO authenticated
  USING (app_private.has_client_access(auth.uid(), client_id));

CREATE TRIGGER client_statutory_accounts_set_updated_at
  BEFORE UPDATE ON public.client_statutory_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();