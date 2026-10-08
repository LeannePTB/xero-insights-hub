-- Credit card debt (amount owed, positive) from the nightly Balance Sheet
-- read. Nullable: null means the file has no assessed credit card figure yet.
-- Column only; the table's existing RLS policies and grants already cover it.
ALTER TABLE public.client_key_figures
  ADD COLUMN credit_card_debt numeric;