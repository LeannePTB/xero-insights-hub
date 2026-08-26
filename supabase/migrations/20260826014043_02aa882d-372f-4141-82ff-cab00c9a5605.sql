CREATE OR REPLACE FUNCTION public.claim_xero_snapshot_run(
  _client_id uuid,
  _firm_id uuid,
  _tenant_id text,
  _trigger text DEFAULT 'scheduled',
  _abandoned_minutes integer DEFAULT 30
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_run_id uuid;
BEGIN
  IF _trigger NOT IN ('scheduled','manual','backfill') THEN
    RAISE EXCEPTION 'invalid trigger %', _trigger;
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtextextended('xero_snapshot_run:' || _tenant_id, 0)) THEN
    RETURN NULL;
  END IF;

  PERFORM 1
    FROM public.xero_snapshot_runs
   WHERE tenant_id = _tenant_id
     AND client_id = _client_id
     AND status = 'running'
     AND started_at > now() - make_interval(mins => _abandoned_minutes)
   LIMIT 1;
  IF FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.xero_snapshot_runs (client_id, firm_id, tenant_id, trigger, status)
  VALUES (_client_id, _firm_id, _tenant_id, _trigger, 'running')
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_xero_snapshot_run(uuid, uuid, text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_xero_snapshot_run(uuid, uuid, text, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_xero_snapshot_run(uuid, uuid, text, text, integer) TO service_role;