CREATE OR REPLACE FUNCTION public.trixie_cost_guard() RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $fn$
DECLARE g numeric;
BEGIN
  PERFORM app_private.assert_aal2();
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT s.token_cost_guard_usd INTO g FROM public.trixie_settings s WHERE s.singleton;
  RETURN COALESCE(g, 0.25);
END; $fn$;
REVOKE ALL ON FUNCTION public.trixie_cost_guard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trixie_cost_guard() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_trixie_alert_settings()
RETURNS TABLE(spend_alert_thresholds_usd numeric[], daily_spike_multiplier numeric, daily_spike_floor_usd numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $fn$
BEGIN
  PERFORM app_private.assert_aal2();
  IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT s.spend_alert_thresholds_usd::numeric[], s.daily_spike_multiplier::numeric, s.daily_spike_floor_usd::numeric
  FROM public.trixie_settings s WHERE s.singleton;
END; $fn$;

CREATE OR REPLACE FUNCTION public.save_trixie_alert_settings(_thresholds numeric[], _multiplier numeric) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = 'public' AS $fn$
DECLARE t numeric;
BEGIN
  PERFORM app_private.assert_aal2();
  IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF coalesce(array_length(_thresholds,1),0) > 10 OR _multiplier IS NULL OR _multiplier <= 1 OR _multiplier > 50 THEN RAISE EXCEPTION 'Invalid alert settings'; END IF;
  FOREACH t IN ARRAY coalesce(_thresholds,'{}') LOOP IF t IS NULL OR t <= 0 OR t > 1000000 THEN RAISE EXCEPTION 'Invalid alert settings'; END IF; END LOOP;
  UPDATE public.trixie_settings SET spend_alert_thresholds_usd = (SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') FROM unnest(_thresholds) x),
    daily_spike_multiplier = _multiplier, updated_at = now(), updated_by = auth.uid() WHERE singleton;
  INSERT INTO public.audit_log(actor_user_id, action, target_type, target_id, meta)
  VALUES (auth.uid(), 'trixie_alert_settings_updated', 'trixie_settings', 'singleton', jsonb_build_object('thresholds', _thresholds, 'multiplier', _multiplier));
  RETURN true;
END; $fn$;
REVOKE ALL ON FUNCTION public.admin_trixie_alert_settings(), public.save_trixie_alert_settings(numeric[], numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_trixie_alert_settings(), public.save_trixie_alert_settings(numeric[], numeric) TO authenticated, service_role;