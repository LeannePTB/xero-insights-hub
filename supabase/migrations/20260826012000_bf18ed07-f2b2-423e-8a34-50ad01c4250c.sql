-- Claim a tenant for refresh. Returns the new run id, or NULL when another
-- run is already in flight for the same (client, tenant).
--
-- The advisory lock serialises two concurrent claims for the same tenant so
-- both cannot observe "no running row" and each insert one. It is a
-- transaction-scoped lock and is released when this function returns; the
-- 'running' row itself is what excludes the rest of the run.
--
-- A run that dies mid-flight never sets finished_at. Such a row stops
-- excluding new claims after _abandoned_minutes, and is deleted entirely by
-- public.prune_xero_snapshot_runs() once it is older than its 24h sweep.
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

  IF NOT pg_try_advisory_xact_lock(hashtextextended('xero_snapshot_run', 0), hashtextextended(_tenant_id, 0)) THEN
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


-- Write one refreshed report.
--
-- The ON CONFLICT guard compares fetched_at (stamped when Xero responded, not
-- when the write ran), so a slow response from an earlier tick cannot
-- overwrite a newer row. A report that failed never calls this function, so
-- the previous good row is left untouched.
CREATE OR REPLACE FUNCTION public.upsert_xero_snapshot(
  _client_id uuid,
  _firm_id uuid,
  _tenant_id text,
  _report_key text,
  _params_hash text,
  _params jsonb,
  _source_endpoint text,
  _payload jsonb,
  _payload_version integer,
  _as_at timestamptz,
  _fetched_at timestamptz,
  _run_id uuid DEFAULT NULL,
  _complete boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.xero_snapshots (
    client_id, firm_id, tenant_id, report_key, params_hash, params,
    source_endpoint, payload, payload_version, as_at, fetched_at, complete, run_id
  )
  VALUES (
    _client_id, _firm_id, _tenant_id, _report_key, _params_hash, coalesce(_params, '{}'::jsonb),
    _source_endpoint, _payload, _payload_version, _as_at, _fetched_at, _complete, _run_id
  )
  ON CONFLICT (client_id, tenant_id, report_key, params_hash) DO UPDATE
     SET firm_id         = excluded.firm_id,
         params          = excluded.params,
         source_endpoint = excluded.source_endpoint,
         payload         = excluded.payload,
         payload_version = excluded.payload_version,
         as_at           = excluded.as_at,
         fetched_at      = excluded.fetched_at,
         complete        = excluded.complete,
         run_id          = excluded.run_id
   WHERE excluded.fetched_at > public.xero_snapshots.fetched_at
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id
      FROM public.xero_snapshots
     WHERE client_id = _client_id
       AND tenant_id = _tenant_id
       AND report_key = _report_key
       AND params_hash = _params_hash;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_xero_snapshot(uuid, uuid, text, text, text, jsonb, text, jsonb, integer, timestamptz, timestamptz, uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_xero_snapshot(uuid, uuid, text, text, text, jsonb, text, jsonb, integer, timestamptz, timestamptz, uuid, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_xero_snapshot(uuid, uuid, text, text, text, jsonb, text, jsonb, integer, timestamptz, timestamptz, uuid, boolean) TO service_role;