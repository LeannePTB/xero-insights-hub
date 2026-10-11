-- Trixie usage alerts, spend accounting and scheduled maintenance.
-- No prompt, answer or client financial figure is stored or alerted on: only
-- Trixie's own question counts, token counts and US dollar spend.

ALTER TABLE public.trixie_settings
  ADD COLUMN IF NOT EXISTS spend_alert_thresholds_usd numeric(10,2)[] NOT NULL DEFAULT '{25,50,100}',
  ADD COLUMN IF NOT EXISTS daily_spike_multiplier numeric(5,2) NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS daily_spike_floor_usd numeric(10,2) NOT NULL DEFAULT 1;
ALTER TABLE public.trixie_settings ALTER COLUMN token_cost_guard_usd SET DEFAULT 0.25;
ALTER TABLE public.trixie_settings DROP CONSTRAINT IF EXISTS trixie_settings_thresholds_sane;
ALTER TABLE public.trixie_settings ADD CONSTRAINT trixie_settings_thresholds_sane
  CHECK (coalesce(array_length(spend_alert_thresholds_usd,1),0) <= 10
         AND daily_spike_multiplier > 1 AND daily_spike_floor_usd >= 0);

INSERT INTO public.trixie_settings(singleton, token_cost_guard_usd)
VALUES (true, 0.25)
ON CONFLICT (singleton) DO UPDATE SET token_cost_guard_usd = COALESCE(public.trixie_settings.token_cost_guard_usd, 0.25);

CREATE TABLE IF NOT EXISTS public.trixie_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL CHECK (kind IN ('platform_spend','org_allowance','daily_spike')),
  severity text NOT NULL DEFAULT 'warn' CHECK (severity IN ('info','warn','action')),
  firm_id uuid REFERENCES public.firms(id) ON DELETE SET NULL,
  title text NOT NULL,
  detail text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  emailed_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid
);
REVOKE ALL ON public.trixie_alerts FROM anon, authenticated;
GRANT ALL ON public.trixie_alerts TO service_role;
ALTER TABLE public.trixie_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mfa_aal2_required ON public.trixie_alerts;
CREATE POLICY mfa_aal2_required ON public.trixie_alerts AS RESTRICTIVE FOR ALL TO authenticated USING (app_private.is_aal2()) WITH CHECK (app_private.is_aal2());
CREATE INDEX IF NOT EXISTS trixie_alerts_open_idx ON public.trixie_alerts(acknowledged_at, created_at DESC);

CREATE INDEX IF NOT EXISTS trixie_usage_day_idx ON public.trixie_usage(requested_at DESC) WHERE status = 'completed';

-- System contexts (cron, service role) have no auth.uid(); a signed-in caller
-- must still be an aal2 super admin.
CREATE OR REPLACE FUNCTION app_private.assert_trixie_maintenance() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  PERFORM app_private.assert_aal2();
  IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
END; $fn$;
REVOKE ALL ON FUNCTION app_private.assert_trixie_maintenance() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.purge_trixie_usage() RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = 'public' AS $fn$
DECLARE n integer;
BEGIN
  PERFORM app_private.assert_trixie_maintenance();
  DELETE FROM public.trixie_usage WHERE requested_at < now() - interval '13 months';
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.trixie_alerts WHERE created_at < now() - interval '13 months';
  RETURN n;
END; $fn$;

-- A reservation left behind by a dropped connection must not consume an
-- organisation's allowance for ever.
CREATE OR REPLACE FUNCTION public.expire_trixie_reservations() RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = 'public' AS $fn$
DECLARE n integer;
BEGIN
  PERFORM app_private.assert_trixie_maintenance();
  UPDATE public.trixie_usage SET status = 'cancelled', completed_at = now(), error_code = 'expired'
  WHERE status = 'reserved' AND requested_at < now() - interval '20 minutes';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $fn$;

CREATE OR REPLACE FUNCTION public.admin_trixie_spend_overview(_days integer DEFAULT 30)
RETURNS TABLE(day date, spend_usd numeric, questions bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $fn$
BEGIN
  PERFORM app_private.assert_aal2();
  IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT d::date,
         COALESCE(sum(u.estimated_cost_usd) FILTER (WHERE u.status = 'completed'), 0)::numeric,
         count(u.id) FILTER (WHERE u.status = 'completed')
  FROM generate_series(date_trunc('day', now()) - ((LEAST(GREATEST(_days,1),90) - 1) * interval '1 day'), date_trunc('day', now()), interval '1 day') AS d
  LEFT JOIN public.trixie_usage u ON date_trunc('day', u.requested_at) = d
  GROUP BY d ORDER BY d;
END; $fn$;

CREATE OR REPLACE FUNCTION public.admin_trixie_alerts(_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, created_at timestamptz, kind text, severity text, firm_id uuid, firm_name text, title text, detail text, acknowledged_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $fn$
BEGIN
  PERFORM app_private.assert_aal2();
  IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT a.id, a.created_at, a.kind, a.severity, a.firm_id, f.name, a.title, a.detail, a.acknowledged_at
  FROM public.trixie_alerts a LEFT JOIN public.firms f ON f.id = a.firm_id
  ORDER BY a.acknowledged_at NULLS FIRST, a.created_at DESC
  LIMIT LEAST(GREATEST(_limit,1),200);
END; $fn$;

CREATE OR REPLACE FUNCTION public.acknowledge_trixie_alert(_id uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = 'public' AS $fn$
BEGIN
  PERFORM app_private.assert_aal2();
  IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.trixie_alerts SET acknowledged_at = now(), acknowledged_by = auth.uid()
  WHERE id = _id AND acknowledged_at IS NULL;
  RETURN FOUND;
END; $fn$;

-- Raises any alert that is now true and has not been raised before. Returns the
-- alerts still waiting to be emailed. Spend and question counts only.
CREATE OR REPLACE FUNCTION public.evaluate_trixie_alerts()
RETURNS TABLE(id uuid, kind text, severity text, firm_name text, title text, detail text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = 'public' AS $fn$
DECLARE s record; mtd numeric; mk text := to_char(date_trunc('month', now()), 'YYYY-MM');
        t numeric; r record; yest numeric; base numeric;
BEGIN
  PERFORM app_private.assert_trixie_maintenance();
  SELECT COALESCE(x.spend_alert_thresholds_usd,'{}') AS thresholds,
         x.default_monthly_allowance AS default_allowance,
         COALESCE(x.warning_threshold, 80) AS warning,
         COALESCE(x.daily_spike_multiplier, 3) AS multiplier,
         COALESCE(x.daily_spike_floor_usd, 1) AS floor_usd
  INTO s FROM public.trixie_settings x WHERE x.singleton;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(sum(u.estimated_cost_usd),0) INTO mtd FROM public.trixie_usage u
   WHERE u.status = 'completed' AND u.requested_at >= date_trunc('month', now());
  FOREACH t IN ARRAY s.thresholds LOOP
    IF mtd >= t THEN
      INSERT INTO public.trixie_alerts(kind, severity, title, detail, dedupe_key)
      VALUES ('platform_spend', CASE WHEN t >= 100 THEN 'action' ELSE 'warn' END,
              'Trixie spend passed US$' || trim(to_char(t,'FM999990.00')),
              'Month-to-date Trixie spend is US$' || trim(to_char(mtd,'FM999990.00')) || ' for ' || mk || '.',
              'platform_spend:' || mk || ':' || trim(to_char(t,'FM999990.00')))
      ON CONFLICT (dedupe_key) DO NOTHING;
    END IF;
  END LOOP;

  FOR r IN
    SELECT f.id AS firm_id, f.name,
           COALESCE(l.monthly_allowance, s.default_allowance) AS allowance,
           (SELECT count(*) FROM public.trixie_usage u WHERE u.firm_id = f.id
              AND u.requested_at >= date_trunc('month', now()) AND u.status IN ('reserved','completed')) AS used
    FROM public.firms f LEFT JOIN public.trixie_org_limits l ON l.firm_id = f.id
  LOOP
    IF r.allowance IS NULL OR r.used = 0 THEN CONTINUE; END IF;
    IF r.used >= r.allowance THEN
      INSERT INTO public.trixie_alerts(kind, severity, firm_id, title, detail, dedupe_key)
      VALUES ('org_allowance','action', r.firm_id, r.name || ' reached its Trixie allowance',
              r.name || ' has used ' || r.used || ' of ' || r.allowance || ' questions for ' || mk || '.',
              'org_allowance:' || mk || ':' || r.firm_id || ':100')
      ON CONFLICT (dedupe_key) DO NOTHING;
    ELSIF r.used::numeric >= r.allowance::numeric * (s.warning::numeric / 100) THEN
      INSERT INTO public.trixie_alerts(kind, severity, firm_id, title, detail, dedupe_key)
      VALUES ('org_allowance','warn', r.firm_id, r.name || ' is near its Trixie allowance',
              r.name || ' has used ' || r.used || ' of ' || r.allowance || ' questions for ' || mk || '.',
              'org_allowance:' || mk || ':' || r.firm_id || ':' || s.warning)
      ON CONFLICT (dedupe_key) DO NOTHING;
    END IF;
  END LOOP;

  SELECT COALESCE(sum(u.estimated_cost_usd),0) INTO yest FROM public.trixie_usage u
   WHERE u.status = 'completed' AND u.requested_at >= date_trunc('day', now()) - interval '1 day'
     AND u.requested_at < date_trunc('day', now());
  SELECT COALESCE(sum(u.estimated_cost_usd),0) / 7 INTO base FROM public.trixie_usage u
   WHERE u.status = 'completed' AND u.requested_at >= date_trunc('day', now()) - interval '8 days'
     AND u.requested_at < date_trunc('day', now()) - interval '1 day';
  IF yest >= s.floor_usd AND base > 0 AND yest > base * s.multiplier THEN
    INSERT INTO public.trixie_alerts(kind, severity, title, detail, dedupe_key)
    VALUES ('daily_spike','warn','Trixie spend spike yesterday',
            'Yesterday''s Trixie spend was US$' || trim(to_char(yest,'FM999990.00')) ||
            ', more than ' || trim(to_char(s.multiplier,'FM990.0')) || ' times the trailing seven-day daily average of US$' || trim(to_char(base,'FM999990.00')) || '.',
            'daily_spike:' || to_char(date_trunc('day', now()) - interval '1 day','YYYY-MM-DD'))
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN QUERY SELECT a.id, a.kind, a.severity, f.name, a.title, a.detail
  FROM public.trixie_alerts a LEFT JOIN public.firms f ON f.id = a.firm_id
  WHERE a.emailed_at IS NULL ORDER BY a.created_at;
END; $fn$;

CREATE OR REPLACE FUNCTION public.mark_trixie_alert_emailed(_id uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = 'public' AS $fn$
BEGIN
  PERFORM app_private.assert_trixie_maintenance();
  UPDATE public.trixie_alerts SET emailed_at = now() WHERE id = _id AND emailed_at IS NULL;
  RETURN FOUND;
END; $fn$;

CREATE OR REPLACE FUNCTION public.trixie_monthly_summary(_month date DEFAULT (date_trunc('month', now()) - interval '1 month')::date)
RETURNS TABLE(scope text, label text, model text, questions bigint, spend_usd numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $fn$
DECLARE a timestamptz := date_trunc('month', _month::timestamptz); b timestamptz := date_trunc('month', _month::timestamptz) + interval '1 month';
BEGIN
  PERFORM app_private.assert_trixie_maintenance();
  RETURN QUERY
  SELECT 'organisation'::text, COALESCE(f.name,'System Admin'), NULL::text,
         count(*) FILTER (WHERE u.status='completed'), COALESCE(sum(u.estimated_cost_usd) FILTER (WHERE u.status='completed'),0)::numeric
  FROM public.trixie_usage u LEFT JOIN public.firms f ON f.id = u.firm_id
  WHERE u.requested_at >= a AND u.requested_at < b GROUP BY f.name
  UNION ALL
  SELECT 'model'::text, u.model, u.model,
         count(*) FILTER (WHERE u.status='completed'), COALESCE(sum(u.estimated_cost_usd) FILTER (WHERE u.status='completed'),0)::numeric
  FROM public.trixie_usage u WHERE u.requested_at >= a AND u.requested_at < b GROUP BY u.model;
END; $fn$;

CREATE OR REPLACE FUNCTION public.admin_trixie_summary_preview(_month date DEFAULT (date_trunc('month', now()) - interval '1 month')::date)
RETURNS TABLE(scope text, label text, model text, questions bigint, spend_usd numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $fn$
BEGIN
  PERFORM app_private.assert_aal2();
  IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT * FROM public.trixie_monthly_summary(_month);
END; $fn$;

REVOKE ALL ON FUNCTION
  public.admin_trixie_spend_overview(integer), public.admin_trixie_alerts(integer), public.acknowledge_trixie_alert(uuid),
  public.evaluate_trixie_alerts(), public.mark_trixie_alert_emailed(uuid), public.trixie_monthly_summary(date),
  public.admin_trixie_summary_preview(date), public.expire_trixie_reservations(), public.purge_trixie_usage()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.admin_trixie_spend_overview(integer), public.admin_trixie_alerts(integer), public.acknowledge_trixie_alert(uuid),
  public.admin_trixie_summary_preview(date)
TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.evaluate_trixie_alerts(), public.mark_trixie_alert_emailed(uuid), public.trixie_monthly_summary(date),
  public.expire_trixie_reservations(), public.purge_trixie_usage()
TO service_role;