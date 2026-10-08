CREATE TABLE public.client_income_tax_instalments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount numeric(14,2) NOT NULL,
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_income_tax_instalments_period_valid CHECK (period_end >= period_start),
  CONSTRAINT client_income_tax_instalments_amount_valid CHECK (amount >= 0 AND amount <= 999999999999.99),
  CONSTRAINT client_income_tax_instalments_unique_period UNIQUE (client_id, tenant_id, period_start, period_end)
);

REVOKE ALL ON public.client_income_tax_instalments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.client_income_tax_instalments TO authenticated;
GRANT ALL ON public.client_income_tax_instalments TO service_role;

ALTER TABLE public.client_income_tax_instalments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read income tax instalments"
ON public.client_income_tax_instalments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_income_tax_instalments.client_id
      AND (
        c.owner_user_id = auth.uid()
        OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id))
      )
  )
);

CREATE POLICY "Client access reads income tax instalments"
ON public.client_income_tax_instalments
FOR SELECT TO authenticated
USING (app_private.has_client_read_access(auth.uid(), client_id));

CREATE POLICY "Support reads income tax instalments"
ON public.client_income_tax_instalments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_income_tax_instalments.client_id
      AND c.firm_id IS NOT NULL
      AND app_private.platform_staff_can_access_firm(auth.uid(), c.firm_id)
  )
);

CREATE POLICY "MFA required for income tax instalments"
ON public.client_income_tax_instalments
AS RESTRICTIVE FOR ALL TO authenticated
USING (app_private.is_aal2())
WITH CHECK (app_private.is_aal2());

CREATE INDEX client_income_tax_instalments_lookup
ON public.client_income_tax_instalments (client_id, tenant_id, period_end DESC);

CREATE TRIGGER client_income_tax_instalments_set_updated_at
BEFORE UPDATE ON public.client_income_tax_instalments
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.save_client_income_tax_instalment(
  _client_id uuid,
  _tenant_id text,
  _period_start date,
  _period_end date,
  _amount numeric
)
RETURNS public.client_income_tax_instalments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _firm_id uuid;
  _allowed boolean := false;
  _saved public.client_income_tax_instalments;
BEGIN
  PERFORM app_private.assert_aal2();

  IF _actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF _client_id IS NULL OR _tenant_id IS NULL OR btrim(_tenant_id) = '' THEN
    RAISE EXCEPTION 'INVALID_CLIENT_OR_XERO_FILE' USING ERRCODE = '22023';
  END IF;
  IF _period_start IS NULL OR _period_end IS NULL OR _period_end < _period_start THEN
    RAISE EXCEPTION 'INVALID_INSTALMENT_PERIOD' USING ERRCODE = '22023';
  END IF;
  IF _amount IS NULL OR _amount < 0 OR _amount > 999999999999.99 OR round(_amount, 2) <> _amount THEN
    RAISE EXCEPTION 'INVALID_INSTALMENT_AMOUNT' USING ERRCODE = '22023';
  END IF;

  SELECT c.firm_id,
         app_private.user_can_write_client(_actor, c.id)
         OR EXISTS (
           SELECT 1 FROM public.client_access ca
           WHERE ca.client_id = c.id
             AND ca.user_id = _actor
             AND ca.relationship = 'business_owner'
         )
    INTO _firm_id, _allowed
    FROM public.clients c
   WHERE c.id = _client_id;

  IF NOT coalesce(_allowed, false) THEN
    RAISE EXCEPTION 'CLIENT_INCOME_TAX_INSTALMENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_tenant_belongs_to_client(_client_id, _tenant_id);

  INSERT INTO public.client_income_tax_instalments (
    client_id, tenant_id, period_start, period_end, amount, created_by, updated_by
  ) VALUES (
    _client_id, btrim(_tenant_id), _period_start, _period_end, _amount, _actor, _actor
  )
  ON CONFLICT (client_id, tenant_id, period_start, period_end)
  DO UPDATE SET amount = EXCLUDED.amount, updated_by = _actor, updated_at = now()
  RETURNING * INTO _saved;

  INSERT INTO public.audit_log (
    actor_user_id, firm_id, action, target_type, target_id, meta
  ) VALUES (
    _actor,
    _firm_id,
    'client_income_tax_instalment_saved',
    'client',
    _client_id::text,
    jsonb_build_object(
      'tenant_id', btrim(_tenant_id),
      'period_start', _period_start,
      'period_end', _period_end
    )
  );

  RETURN _saved;
END;
$$;

REVOKE ALL ON FUNCTION public.save_client_income_tax_instalment(uuid, text, date, date, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_client_income_tax_instalment(uuid, text, date, date, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.card_group_cards(_group text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _group
    WHEN 'standard' THEN ARRAY['health','receivables','payables','pnl','notes']
    WHEN 'advisory' THEN ARRAY['cashflow','cashflow_scenario','accounting_breakeven','tax_obligations','gst_reconciliation','superannuation','payg_withholding','xero_audit','transaction_search']
    WHEN 'consolidation' THEN ARRAY['loan_consolidation']
    ELSE '{}'::text[]
  END
$$;
REVOKE EXECUTE ON FUNCTION app_private.card_group_cards(text) FROM anon;

UPDATE public.client_cards
SET cards = array_append(cards, 'tax_obligations'), updated_at = now()
WHERE NOT ('tax_obligations' = ANY(cards))
  AND ('gst_reconciliation' = ANY(cards) OR 'payg_withholding' = ANY(cards));

UPDATE public.org_card_defaults
SET cards = array_append(cards, 'tax_obligations'), updated_at = now()
WHERE NOT ('tax_obligations' = ANY(cards))
  AND ('gst_reconciliation' = ANY(cards) OR 'payg_withholding' = ANY(cards));