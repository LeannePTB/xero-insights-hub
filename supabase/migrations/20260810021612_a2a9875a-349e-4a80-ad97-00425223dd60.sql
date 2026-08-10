CREATE TABLE public.loan_consolidation_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  tenant_id text not null,
  account_id text,
  account_code text,
  account_name text,
  account_type text,
  direction text not null default 'payable',
  counterparty_account_id uuid references public.loan_consolidation_accounts(id),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_consolidation_accounts TO authenticated;
GRANT ALL ON public.loan_consolidation_accounts TO service_role;

ALTER TABLE public.loan_consolidation_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm owners and advisors manage loan accounts"
  ON public.loan_consolidation_accounts FOR ALL
  TO authenticated
  USING (app_private.user_can_manage_client(auth.uid(), client_id) OR app_private.is_advisor(auth.uid()))
  WITH CHECK (app_private.user_can_manage_client(auth.uid(), client_id) OR app_private.is_advisor(auth.uid()));

CREATE POLICY "viewers read loan accounts for their client"
  ON public.loan_consolidation_accounts FOR SELECT
  TO authenticated
  USING (app_private.has_client_access(auth.uid(), client_id));

CREATE TRIGGER loan_consolidation_accounts_set_updated_at BEFORE UPDATE ON public.loan_consolidation_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX loan_consolidation_accounts_client_idx ON public.loan_consolidation_accounts(client_id);
CREATE INDEX loan_consolidation_accounts_tenant_idx ON public.loan_consolidation_accounts(tenant_id);