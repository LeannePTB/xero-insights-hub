-- Widen bank-account classifications with an explicit 'excluded' value:
-- the account is left out of both cash at bank and credit-card debt.
-- Same table, policies and save function; only the allowed value set widens.
ALTER TABLE public.client_bank_account_classifications
  DROP CONSTRAINT client_bank_account_classifications_classification_check;
ALTER TABLE public.client_bank_account_classifications
  ADD CONSTRAINT client_bank_account_classifications_classification_check
  CHECK (classification IN ('bank','credit_card','excluded'));

CREATE OR REPLACE FUNCTION public.save_client_bank_account_classification(_client_id uuid, _tenant_id text, _account_id uuid, _classification text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_firm_id uuid; v_previous text;
BEGIN
 PERFORM app_private.assert_aal2();
 IF auth.uid() IS NULL OR NOT app_private.user_can_write_client(auth.uid(), _client_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
 PERFORM public.assert_tenant_belongs_to_client(_client_id, _tenant_id);
 IF _classification IS NOT NULL AND _classification NOT IN ('bank','credit_card','excluded') THEN RAISE EXCEPTION 'Invalid classification'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.xero_snapshots s CROSS JOIN LATERAL jsonb_array_elements(s.payload->'Accounts') a WHERE s.client_id = _client_id AND s.tenant_id = _tenant_id AND s.report_key = 'accounts' AND s.complete AND a->>'AccountID' = _account_id::text AND upper(a->>'Type') = 'BANK' AND upper(a->>'Status') = 'ACTIVE') THEN RAISE EXCEPTION 'Account unavailable'; END IF;
 SELECT firm_id INTO v_firm_id FROM public.clients WHERE id = _client_id;
 SELECT classification INTO v_previous FROM public.client_bank_account_classifications WHERE client_id = _client_id AND tenant_id = _tenant_id AND account_id = _account_id FOR UPDATE;
 IF _classification IS NULL THEN
  DELETE FROM public.client_bank_account_classifications WHERE client_id = _client_id AND tenant_id = _tenant_id AND account_id = _account_id;
 ELSE
  INSERT INTO public.client_bank_account_classifications (client_id, tenant_id, account_id, classification, updated_by) VALUES (_client_id, _tenant_id, _account_id, _classification, auth.uid()) ON CONFLICT (client_id, tenant_id, account_id) DO UPDATE SET classification = excluded.classification, updated_by = auth.uid(), updated_at = now();
 END IF;
 INSERT INTO public.audit_log(actor_user_id, firm_id, action, target_type, target_id, meta) VALUES (auth.uid(), v_firm_id, 'client_bank_account_classification_changed', 'client', _client_id::text, jsonb_build_object('tenant_id', _tenant_id, 'account_id', _account_id, 'previous', v_previous, 'classification', _classification));
END;
$function$;
REVOKE ALL ON FUNCTION public.save_client_bank_account_classification(uuid,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_client_bank_account_classification(uuid,text,uuid,text) TO authenticated;
