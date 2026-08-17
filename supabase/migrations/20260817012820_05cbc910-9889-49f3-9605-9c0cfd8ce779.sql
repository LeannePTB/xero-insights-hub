CREATE TABLE IF NOT EXISTS public.security_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  audit_retention_days integer NOT NULL DEFAULT 730,
  login_retention_days integer NOT NULL DEFAULT 730,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.security_settings TO authenticated;
GRANT ALL ON public.security_settings TO service_role;

ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins read security settings" ON public.security_settings;
CREATE POLICY "Super admins read security settings"
  ON public.security_settings FOR SELECT TO authenticated
  USING (public.me_is_super_admin());

DROP TRIGGER IF EXISTS security_settings_set_updated_at ON public.security_settings;
CREATE TRIGGER security_settings_set_updated_at
  BEFORE UPDATE ON public.security_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.security_settings (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.purge_expired_security_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_days integer;
  v_login_days integer;
  v_audit_deleted integer := 0;
  v_login_deleted integer := 0;
BEGIN
  SELECT audit_retention_days, login_retention_days
    INTO v_audit_days, v_login_days
  FROM public.security_settings WHERE singleton = true;

  v_audit_days := COALESCE(v_audit_days, 730);
  v_login_days := COALESCE(v_login_days, 730);

  DELETE FROM public.audit_log
   WHERE at < now() - make_interval(days => v_audit_days)
     AND action <> 'audit_retention_purge';
  GET DIAGNOSTICS v_audit_deleted = ROW_COUNT;

  DELETE FROM public.login_events
   WHERE occurred_at < now() - make_interval(days => v_login_days);
  GET DIAGNOSTICS v_login_deleted = ROW_COUNT;

  IF v_audit_deleted > 0 OR v_login_deleted > 0 THEN
    INSERT INTO public.audit_log (actor_user_id, action, target_type, target_id, meta)
    VALUES (NULL, 'audit_retention_purge', 'system', 'retention',
            jsonb_build_object(
              'audit_rows_deleted', v_audit_deleted,
              'login_rows_deleted', v_login_deleted,
              'audit_retention_days', v_audit_days,
              'login_retention_days', v_login_days));
  END IF;

  RETURN jsonb_build_object('audit_rows_deleted', v_audit_deleted, 'login_rows_deleted', v_login_deleted);
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_security_logs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_security_logs() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('purge-expired-security-logs')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-expired-security-logs');
    PERFORM cron.schedule('purge-expired-security-logs', '17 3 * * *',
      $cron$ SELECT public.purge_expired_security_logs(); $cron$);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'could not schedule purge-expired-security-logs: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS audit_log_at_idx ON public.audit_log (at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_at_idx ON public.audit_log (action, at DESC);