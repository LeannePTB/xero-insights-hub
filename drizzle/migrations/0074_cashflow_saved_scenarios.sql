CREATE TABLE public.client_cashflow_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(payload) <= 65536),
  report_table jsonb CHECK (report_table IS NULL OR pg_column_size(report_table) <= 16384),
  report_period_end date,
  shared_with_client boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_cashflow_scenarios_client_idx ON public.client_cashflow_scenarios(client_id);
CREATE UNIQUE INDEX client_cashflow_scenarios_report_idx ON public.client_cashflow_scenarios(client_id, report_period_end) WHERE report_period_end IS NOT NULL;

REVOKE ALL ON public.client_cashflow_scenarios FROM anon, authenticated;
GRANT SELECT ON TABLE public.client_cashflow_scenarios TO authenticated;
GRANT ALL ON public.client_cashflow_scenarios TO service_role;
ALTER TABLE public.client_cashflow_scenarios ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_private.is_client_business_owner(_user_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select case when auth.uid() is not null and _user_id is distinct from auth.uid() then false else (
    select exists (select 1 from public.client_access ca
      where ca.user_id = _user_id and ca.client_id = _client_id and ca.relationship = 'business_owner')
  ) end
$$;
REVOKE EXECUTE ON FUNCTION app_private.is_client_business_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.is_client_business_owner(uuid, uuid) TO authenticated;

CREATE POLICY mfa_aal2_required ON public.client_cashflow_scenarios AS RESTRICTIVE FOR ALL TO authenticated USING (app_private.is_aal2()) WITH CHECK (app_private.is_aal2());
CREATE POLICY "Managers read cashflow scenarios" ON public.client_cashflow_scenarios AS PERMISSIVE FOR SELECT TO authenticated
  USING (app_private.user_can_write_client(auth.uid(), client_id));
CREATE POLICY "Business Owners read shared cashflow scenarios" ON public.client_cashflow_scenarios AS PERMISSIVE FOR SELECT TO authenticated
  USING (shared_with_client AND app_private.is_client_business_owner(auth.uid(), client_id));

ALTER TABLE public.client_reports ADD COLUMN scenario_snapshot jsonb;

CREATE OR REPLACE FUNCTION public.save_cashflow_scenario(_client_id uuid, _id uuid, _name text, _payload jsonb, _report_table jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client uuid; v_id uuid; f uuid; n text := btrim(coalesce(_name,''));
BEGIN
  PERFORM app_private.assert_aal2();
  IF _id IS NOT NULL THEN
    SELECT client_id INTO v_client FROM public.client_cashflow_scenarios WHERE id = _id;
    IF v_client IS NULL OR v_client IS DISTINCT FROM _client_id THEN RAISE EXCEPTION 'Scenario not available.' USING ERRCODE='42501'; END IF;
  ELSE v_client := _client_id; END IF;
  IF auth.uid() IS NULL OR v_client IS NULL OR NOT app_private.user_can_write_client(auth.uid(), v_client) THEN RAISE EXCEPTION 'Scenario not available.' USING ERRCODE='42501'; END IF;
  IF length(n) < 1 OR length(n) > 120 OR _payload IS NULL OR jsonb_typeof(_payload) <> 'object' OR pg_column_size(_payload) > 65536
     OR (_report_table IS NOT NULL AND (jsonb_typeof(_report_table) <> 'object' OR pg_column_size(_report_table) > 16384)) THEN
    RAISE EXCEPTION 'Invalid scenario.'; END IF;
  SELECT firm_id INTO f FROM public.clients WHERE id = v_client;
  IF _id IS NULL THEN
    INSERT INTO public.client_cashflow_scenarios(client_id, name, payload, report_table, created_by, updated_by)
      VALUES (v_client, n, _payload, _report_table, auth.uid(), auth.uid()) RETURNING id INTO v_id;
  ELSE
    UPDATE public.client_cashflow_scenarios SET name = n, payload = _payload, report_table = _report_table, updated_by = auth.uid(), updated_at = now()
      WHERE id = _id RETURNING id INTO v_id;
  END IF;
  INSERT INTO public.audit_log(id, actor_user_id, firm_id, action, target_type, target_id, meta)
    VALUES (gen_random_uuid(), auth.uid(), f, CASE WHEN _id IS NULL THEN 'cashflow_scenario_created' ELSE 'cashflow_scenario_updated' END, 'client', v_client, jsonb_build_object('scenario_id', v_id));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.delete_cashflow_scenario(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client uuid; f uuid;
BEGIN
  PERFORM app_private.assert_aal2();
  SELECT client_id INTO v_client FROM public.client_cashflow_scenarios WHERE id = _id;
  IF auth.uid() IS NULL OR v_client IS NULL OR NOT app_private.user_can_write_client(auth.uid(), v_client) THEN RAISE EXCEPTION 'Scenario not available.' USING ERRCODE='42501'; END IF;
  SELECT firm_id INTO f FROM public.clients WHERE id = v_client;
  DELETE FROM public.client_cashflow_scenarios WHERE id = _id;
  INSERT INTO public.audit_log(id, actor_user_id, firm_id, action, target_type, target_id, meta)
    VALUES (gen_random_uuid(), auth.uid(), f, 'cashflow_scenario_deleted', 'client', v_client, jsonb_build_object('scenario_id', _id));
END $$;

CREATE OR REPLACE FUNCTION public.set_cashflow_scenario_shared(_id uuid, _shared boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client uuid; f uuid;
BEGIN
  PERFORM app_private.assert_aal2();
  SELECT client_id INTO v_client FROM public.client_cashflow_scenarios WHERE id = _id;
  IF auth.uid() IS NULL OR v_client IS NULL OR NOT app_private.user_can_write_client(auth.uid(), v_client) THEN RAISE EXCEPTION 'Scenario not available.' USING ERRCODE='42501'; END IF;
  SELECT firm_id INTO f FROM public.clients WHERE id = v_client;
  UPDATE public.client_cashflow_scenarios SET shared_with_client = coalesce(_shared, false), updated_by = auth.uid(), updated_at = now() WHERE id = _id;
  INSERT INTO public.audit_log(id, actor_user_id, firm_id, action, target_type, target_id, meta)
    VALUES (gen_random_uuid(), auth.uid(), f, CASE WHEN coalesce(_shared,false) THEN 'cashflow_scenario_shared' ELSE 'cashflow_scenario_unshared' END, 'client', v_client, jsonb_build_object('scenario_id', _id));
END $$;

CREATE OR REPLACE FUNCTION public.set_cashflow_scenario_report(_id uuid, _period_end date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client uuid; f uuid;
BEGIN
  PERFORM app_private.assert_aal2();
  SELECT client_id INTO v_client FROM public.client_cashflow_scenarios WHERE id = _id;
  IF auth.uid() IS NULL OR v_client IS NULL OR NOT app_private.user_can_write_client(auth.uid(), v_client) THEN RAISE EXCEPTION 'Scenario not available.' USING ERRCODE='42501'; END IF;
  SELECT firm_id INTO f FROM public.clients WHERE id = v_client;
  IF _period_end IS NOT NULL THEN
    UPDATE public.client_cashflow_scenarios SET report_period_end = NULL WHERE client_id = v_client AND report_period_end = _period_end AND id <> _id;
  END IF;
  UPDATE public.client_cashflow_scenarios SET report_period_end = _period_end, updated_by = auth.uid(), updated_at = now() WHERE id = _id;
  INSERT INTO public.audit_log(id, actor_user_id, firm_id, action, target_type, target_id, meta)
    VALUES (gen_random_uuid(), auth.uid(), f, CASE WHEN _period_end IS NULL THEN 'cashflow_scenario_report_cleared' ELSE 'cashflow_scenario_report_set' END, 'client', v_client, jsonb_build_object('scenario_id', _id, 'period_end', _period_end));
END $$;

REVOKE EXECUTE ON FUNCTION public.save_cashflow_scenario(uuid, uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_cashflow_scenario(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_cashflow_scenario_shared(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_cashflow_scenario_report(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_cashflow_scenario(uuid, uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_cashflow_scenario(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_cashflow_scenario_shared(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_cashflow_scenario_report(uuid, date) TO authenticated;

-- New drafts only: freeze the picked scenario's table into the draft; final/sent locked.
CREATE OR REPLACE FUNCTION public.attach_report_scenario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IN ('final','sent') AND NEW.scenario_snapshot IS DISTINCT FROM OLD.scenario_snapshot THEN
    RAISE EXCEPTION 'This report is locked.'; END IF;
  IF NEW.status = 'draft' AND (TG_OP = 'INSERT' OR NEW.generated_at IS DISTINCT FROM OLD.generated_at) THEN
    SELECT CASE WHEN s.report_table IS NULL THEN NULL ELSE s.report_table || jsonb_build_object('name', s.name) END INTO NEW.scenario_snapshot
      FROM public.client_cashflow_scenarios s WHERE s.client_id = NEW.client_id AND s.report_period_end = NEW.period_end;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.attach_report_scenario() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER client_reports_attach_scenario BEFORE INSERT OR UPDATE ON public.client_reports FOR EACH ROW EXECUTE FUNCTION public.attach_report_scenario();