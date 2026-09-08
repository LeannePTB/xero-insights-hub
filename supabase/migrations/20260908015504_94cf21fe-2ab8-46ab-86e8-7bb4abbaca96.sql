ALTER TABLE public.client_statutory_accounts
  DROP CONSTRAINT client_statutory_accounts_client_id_tenant_id_account_name_key;

ALTER TABLE public.client_statutory_accounts
  ADD CONSTRAINT client_statutory_accounts_client_tenant_account_category_key
  UNIQUE (client_id, tenant_id, account_name, category);

-- "none" means "deliberately not statutory" and cannot coexist with a real
-- category on the same account; enforced in the database so no caller can
-- create a contradictory mapping.
CREATE UNIQUE INDEX client_statutory_accounts_none_exclusive
  ON public.client_statutory_accounts (client_id, tenant_id, account_name)
  WHERE category = 'none';