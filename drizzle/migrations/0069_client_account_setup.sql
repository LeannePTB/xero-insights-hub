CREATE TABLE public.client_account_setup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  account_id uuid,
  setup_group text NOT NULL CHECK (setup_group IN ('bank','tax','cost')),
  value text NOT NULL,
  wages_variable boolean NOT NULL DEFAULT false,
  confirmed boolean NOT NULL DEFAULT true,
  account_name text NOT NULL,
  match_status text NOT NULL DEFAULT 'matched' CHECK (match_status IN ('matched','unmatched')),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_account_setup_value_check CHECK (
    (setup_group = 'bank' AND value IN ('bank','credit_card','overdraft','excluded'))
    OR (setup_group = 'tax' AND value IN ('gst','payg','gst_payg','super','none'))
    OR (setup_group = 'cost' AND value IN ('wages','fixed','variable','excluded'))),
  CONSTRAINT client_account_setup_match_check CHECK ((match_status = 'matched') = (account_id IS NOT NULL))
);
CREATE UNIQUE INDEX client_account_setup_account_key ON public.client_account_setup (client_id, tenant_id, (coalesce(account_id::text, setup_group || ':' || lower(account_name))));
CREATE INDEX client_account_setup_client_idx ON public.client_account_setup (client_id, tenant_id);
COMMENT ON TABLE public.client_account_setup IS 'One tag per Xero account (AccountID) for bank/cash, tax/super and cost decisions. Writes only via save_client_account_setup().';

REVOKE ALL ON public.client_account_setup FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.client_account_setup TO authenticated;
GRANT ALL ON public.client_account_setup TO service_role;
ALTER TABLE public.client_account_setup ENABLE ROW LEVEL SECURITY;
CREATE POLICY mfa_aal2_required ON public.client_account_setup AS RESTRICTIVE FOR ALL TO authenticated
  USING (app_private.is_aal2()) WITH CHECK (app_private.is_aal2());
CREATE POLICY account_setup_read ON public.client_account_setup FOR SELECT TO authenticated
  USING (app_private.user_can_read_client(auth.uid(), client_id));
-- Tax rows keep the support-grant read path the statutory table already had.
CREATE POLICY account_setup_tax_support_read ON public.client_account_setup FOR SELECT TO authenticated
  USING (setup_group = 'tax' AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_account_setup.client_id AND c.firm_id IS NOT NULL AND app_private.platform_staff_can_access_firm(auth.uid(), c.firm_id)));

-- Backfill from the three legacy tables, matching names to AccountIDs via the stored chart.
WITH acc AS (
  SELECT DISTINCT ON (s.client_id, s.tenant_id, lower(regexp_replace(trim(a->>'Name'), '\s+', ' ', 'g')))
    s.client_id, s.tenant_id, (a->>'AccountID')::uuid AS account_id, a->>'Name' AS name,
    lower(regexp_replace(trim(a->>'Name'), '\s+', ' ', 'g')) AS k
  FROM public.xero_snapshots s CROSS JOIN LATERAL jsonb_array_elements(s.payload->'Accounts') a
  WHERE s.report_key = 'accounts' AND s.complete
  ORDER BY s.client_id, s.tenant_id, lower(regexp_replace(trim(a->>'Name'), '\s+', ' ', 'g')), (upper(a->>'Status') = 'ACTIVE') DESC, s.fetched_at DESC
), cost AS (
  SELECT c.client_id, c.tenant_id, acc.account_id, coalesce(acc.name, c.account_name) AS account_name,
    CASE WHEN c.is_wages THEN 'wages' ELSE c.classification END AS value,
    (c.is_wages AND c.classification = 'variable') AS wages_variable, c.updated_at
  FROM public.client_cost_classifications c
  LEFT JOIN acc ON acc.client_id = c.client_id AND acc.tenant_id = c.tenant_id AND acc.k = lower(regexp_replace(trim(c.account_name), '\s+', ' ', 'g'))
), stat AS (
  SELECT st.client_id, st.tenant_id, acc.account_id, coalesce(acc.name, min(st.account_name)) AS account_name,
    CASE WHEN bool_or(st.category = 'gst') AND bool_or(st.category = 'payg') THEN 'gst_payg'
         WHEN bool_or(st.category = 'gst') THEN 'gst'
         WHEN bool_or(st.category = 'payg') THEN 'payg'
         WHEN bool_or(st.category = 'super') THEN 'super'
         ELSE 'none' END AS value, max(st.updated_at) AS updated_at
  FROM public.client_statutory_accounts st
  LEFT JOIN acc ON acc.client_id = st.client_id AND acc.tenant_id = st.tenant_id AND acc.k = lower(regexp_replace(trim(st.account_name), '\s+', ' ', 'g'))
  GROUP BY st.client_id, st.tenant_id, acc.account_id, acc.name, lower(regexp_replace(trim(st.account_name), '\s+', ' ', 'g'))
)
INSERT INTO public.client_account_setup (client_id, tenant_id, account_id, setup_group, value, wages_variable, confirmed, account_name, match_status, updated_at)
SELECT client_id, tenant_id, account_id, 'cost', value, wages_variable, true, account_name, CASE WHEN account_id IS NULL THEN 'unmatched' ELSE 'matched' END, updated_at FROM cost
UNION ALL
SELECT client_id, tenant_id, account_id, 'tax', value, false, true, account_name, CASE WHEN account_id IS NULL THEN 'unmatched' ELSE 'matched' END, updated_at FROM stat
UNION ALL
SELECT b.client_id, b.tenant_id, b.account_id, 'bank', b.classification, false, true,
  coalesce((SELECT acc.name FROM acc WHERE acc.client_id = b.client_id AND acc.tenant_id = b.tenant_id AND acc.account_id = b.account_id LIMIT 1), 'Bank account'),
  'matched', b.updated_at
FROM public.client_bank_account_classifications b;

-- Legacy-shaped readers (confirmed rows only). security_invoker so the table's RLS applies.
CREATE VIEW public.account_setup_bank_v WITH (security_invoker = on) AS
  SELECT client_id, tenant_id, account_id, value AS classification
  FROM public.client_account_setup WHERE setup_group = 'bank' AND confirmed AND account_id IS NOT NULL;
CREATE VIEW public.account_setup_statutory_v WITH (security_invoker = on) AS
  SELECT s.client_id, s.tenant_id, s.account_id, s.account_name, c.category::public.statutory_category AS category
  FROM public.client_account_setup s
  CROSS JOIN LATERAL unnest(CASE s.value WHEN 'gst_payg' THEN ARRAY['gst','payg'] ELSE ARRAY[s.value] END) AS c(category)
  WHERE s.setup_group = 'tax' AND s.confirmed;
CREATE VIEW public.account_setup_cost_v WITH (security_invoker = on) AS
  SELECT client_id, tenant_id, account_id, account_name,
    CASE WHEN value = 'wages' THEN CASE WHEN wages_variable THEN 'variable' ELSE 'fixed' END ELSE value END AS classification,
    (value = 'wages') AS is_wages
  FROM public.client_account_setup WHERE setup_group = 'cost' AND confirmed;
REVOKE ALL ON public.account_setup_bank_v, public.account_setup_statutory_v, public.account_setup_cost_v FROM anon, PUBLIC;
GRANT SELECT ON public.account_setup_bank_v, public.account_setup_statutory_v, public.account_setup_cost_v TO authenticated, service_role;

-- The only write path: AAL2, caller-scoped, audited, one audit row per change.
CREATE OR REPLACE FUNCTION public.save_client_account_setup(_client_id uuid, _tenant_id text, _changes jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_firm_id uuid; ch jsonb; v_account uuid; v_group text; v_value text; v_wv boolean; v_row uuid;
  v_name text; v_class text; v_type text; v_status text; v_prev record; v_count integer := 0;
BEGIN
  PERFORM app_private.assert_aal2();
  IF auth.uid() IS NULL OR NOT app_private.user_can_write_client(auth.uid(), _client_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  PERFORM public.assert_tenant_belongs_to_client(_client_id, _tenant_id);
  IF jsonb_typeof(_changes) <> 'array' OR jsonb_array_length(_changes) > 500 THEN RAISE EXCEPTION 'Invalid changes'; END IF;
  SELECT firm_id INTO v_firm_id FROM public.clients WHERE id = _client_id;

  FOR ch IN SELECT * FROM jsonb_array_elements(_changes) LOOP
    v_value := ch->>'value';
    v_wv := coalesce((ch->>'wages_variable')::boolean, false);
    v_row := nullif(ch->>'row_id', '')::uuid;

    IF v_row IS NOT NULL THEN
      -- Only an unmatched legacy row may be removed by id.
      SELECT * INTO v_prev FROM public.client_account_setup WHERE id = v_row AND client_id = _client_id AND tenant_id = _tenant_id AND match_status = 'unmatched' FOR UPDATE;
      IF NOT FOUND OR v_value IS NOT NULL THEN RAISE EXCEPTION 'Invalid change'; END IF;
      DELETE FROM public.client_account_setup WHERE id = v_row;
      INSERT INTO public.audit_log(actor_user_id, firm_id, action, target_type, target_id, meta)
      VALUES (auth.uid(), v_firm_id, 'client_account_setup_changed', 'client', _client_id::text,
        jsonb_build_object('tenant_id', _tenant_id, 'account_name', v_prev.account_name, 'group', v_prev.setup_group, 'previous', v_prev.value, 'value', NULL, 'unmatched', true));
      v_count := v_count + 1;
      CONTINUE;
    END IF;

    v_account := (ch->>'account_id')::uuid;
    v_group := ch->>'group';
    IF v_group NOT IN ('bank','tax','cost') THEN RAISE EXCEPTION 'Invalid group'; END IF;
    SELECT a->>'Name', upper(a->>'Class'), upper(a->>'Type'), upper(a->>'Status') INTO v_name, v_class, v_type, v_status
      FROM public.xero_snapshots s CROSS JOIN LATERAL jsonb_array_elements(s.payload->'Accounts') a
      WHERE s.client_id = _client_id AND s.tenant_id = _tenant_id AND s.report_key = 'accounts' AND s.complete AND a->>'AccountID' = v_account::text
      ORDER BY s.fetched_at DESC LIMIT 1;
    IF v_name IS NULL THEN RAISE EXCEPTION 'Account unavailable'; END IF;
    IF (v_group = 'bank' AND v_type <> 'BANK')
       OR (v_group = 'cost' AND v_class <> 'EXPENSE')
       OR (v_group = 'tax' AND v_class NOT IN ('LIABILITY','ASSET')) THEN RAISE EXCEPTION 'Account does not fit this group'; END IF;
    IF v_value IS NOT NULL AND NOT (
      (v_group = 'bank' AND v_value IN ('bank','credit_card','overdraft','excluded'))
      OR (v_group = 'tax' AND v_value IN ('gst','payg','gst_payg','super','none'))
      OR (v_group = 'cost' AND v_value IN ('wages','fixed','variable','excluded'))) THEN RAISE EXCEPTION 'Invalid value'; END IF;
    IF v_value IS DISTINCT FROM 'wages' THEN v_wv := false; END IF;

    SELECT * INTO v_prev FROM public.client_account_setup WHERE client_id = _client_id AND tenant_id = _tenant_id AND account_id = v_account FOR UPDATE;
    IF FOUND AND v_prev.value IS NOT DISTINCT FROM v_value AND v_prev.wages_variable = v_wv AND v_prev.setup_group = v_group THEN CONTINUE; END IF;

    IF v_value IS NULL THEN
      DELETE FROM public.client_account_setup WHERE client_id = _client_id AND tenant_id = _tenant_id AND account_id = v_account;
    ELSIF FOUND THEN
      UPDATE public.client_account_setup SET setup_group = v_group, value = v_value, wages_variable = v_wv, confirmed = true,
        account_name = v_name, updated_by = auth.uid(), updated_at = now() WHERE id = v_prev.id;
    ELSE
      INSERT INTO public.client_account_setup (client_id, tenant_id, account_id, setup_group, value, wages_variable, confirmed, account_name, updated_by)
      VALUES (_client_id, _tenant_id, v_account, v_group, v_value, v_wv, true, v_name, auth.uid());
    END IF;
    INSERT INTO public.audit_log(actor_user_id, firm_id, action, target_type, target_id, meta)
    VALUES (auth.uid(), v_firm_id, 'client_account_setup_changed', 'client', _client_id::text,
      jsonb_build_object('tenant_id', _tenant_id, 'account_id', v_account, 'account_name', v_name, 'group', v_group,
        'previous', CASE WHEN v_prev.id IS NULL THEN NULL ELSE v_prev.value END,
        'previous_wages_variable', CASE WHEN v_prev.id IS NULL THEN NULL ELSE v_prev.wages_variable END,
        'value', v_value, 'wages_variable', v_wv));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.save_client_account_setup(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_client_account_setup(uuid, text, jsonb) TO authenticated;

-- Legacy tables: read-only for one release (no data deleted).
REVOKE INSERT, UPDATE, DELETE ON public.client_cost_classifications FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.client_statutory_accounts FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.save_client_bank_account_classification(uuid, text, uuid, text) FROM authenticated;
COMMENT ON TABLE public.client_cost_classifications IS 'DEPRECATED: replaced by client_account_setup (read-only for one release)';
COMMENT ON TABLE public.client_statutory_accounts IS 'DEPRECATED: replaced by client_account_setup (read-only for one release)';
COMMENT ON TABLE public.client_bank_account_classifications IS 'DEPRECATED: replaced by client_account_setup (read-only for one release)';