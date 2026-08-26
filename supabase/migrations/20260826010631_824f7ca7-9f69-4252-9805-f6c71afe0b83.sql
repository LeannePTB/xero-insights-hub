-- ---------------------------------------------------------------------------
-- xero_snapshot_runs: one row per refresh attempt for one Xero tenant.
-- ---------------------------------------------------------------------------
CREATE TABLE public.xero_snapshot_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  firm_id            uuid NOT NULL REFERENCES public.firms(id)   ON DELETE CASCADE,
  tenant_id          text NOT NULL,
  trigger            text NOT NULL,
  status             text NOT NULL DEFAULT 'running',
  reports_requested  integer NOT NULL DEFAULT 0,
  reports_succeeded  integer NOT NULL DEFAULT 0,
  reports_failed     integer NOT NULL DEFAULT 0,
  error              text,
  started_at         timestamptz NOT NULL DEFAULT now(),
  finished_at        timestamptz,
  duration_ms        integer,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xero_snapshot_runs_trigger_chk CHECK (trigger IN ('scheduled','manual','backfill')),
  CONSTRAINT xero_snapshot_runs_status_chk  CHECK (status  IN ('running','complete','partial','failed'))
);

GRANT SELECT ON public.xero_snapshot_runs TO authenticated;
GRANT ALL    ON public.xero_snapshot_runs TO service_role;

ALTER TABLE public.xero_snapshot_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xero_snapshot_runs FORCE  ROW LEVEL SECURITY;

CREATE POLICY "entitled users read snapshot runs"
  ON public.xero_snapshot_runs
  FOR SELECT
  TO authenticated
  USING (
    public.user_can_access_client(auth.uid(), client_id)
    AND app_private.user_can_access_tenant(auth.uid(), tenant_id)
  );

CREATE INDEX xero_snapshot_runs_tenant_started_idx
  ON public.xero_snapshot_runs (tenant_id, started_at DESC);
CREATE INDEX xero_snapshot_runs_client_started_idx
  ON public.xero_snapshot_runs (client_id, started_at DESC);
CREATE INDEX xero_snapshot_runs_firm_idx
  ON public.xero_snapshot_runs (firm_id);

CREATE TRIGGER xero_snapshot_runs_set_updated_at
  BEFORE UPDATE ON public.xero_snapshot_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- xero_snapshots: one row per (client, tenant, report_key, params_hash).
-- ---------------------------------------------------------------------------
CREATE TABLE public.xero_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  firm_id          uuid NOT NULL REFERENCES public.firms(id)   ON DELETE CASCADE,
  tenant_id        text NOT NULL,
  report_key       text NOT NULL,
  params_hash      text NOT NULL,
  params           jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_endpoint  text NOT NULL,
  payload          jsonb NOT NULL,
  payload_version  integer NOT NULL,
  as_at            timestamptz NOT NULL,
  fetched_at       timestamptz NOT NULL DEFAULT now(),
  complete         boolean NOT NULL DEFAULT true,
  run_id           uuid REFERENCES public.xero_snapshot_runs(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xero_snapshots_unique_key
    UNIQUE (client_id, tenant_id, report_key, params_hash)
);

GRANT SELECT ON public.xero_snapshots TO authenticated;
GRANT ALL    ON public.xero_snapshots TO service_role;

ALTER TABLE public.xero_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xero_snapshots FORCE  ROW LEVEL SECURITY;

CREATE POLICY "entitled users read client snapshots"
  ON public.xero_snapshots
  FOR SELECT
  TO authenticated
  USING (
    public.user_can_access_client(auth.uid(), client_id)
    AND app_private.user_can_access_tenant(auth.uid(), tenant_id)
  );

CREATE INDEX xero_snapshots_tenant_report_idx
  ON public.xero_snapshots (tenant_id, report_key, fetched_at DESC);
CREATE INDEX xero_snapshots_client_report_idx
  ON public.xero_snapshots (client_id, report_key, fetched_at DESC);
CREATE INDEX xero_snapshots_firm_report_idx
  ON public.xero_snapshots (firm_id, report_key);

CREATE TRIGGER xero_snapshots_set_updated_at
  BEFORE UPDATE ON public.xero_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Retention for the diagnostic runs table. NOT scheduled: ships uncalled.
-- The windows live in the parameter defaults, so they can be changed in one
-- place (or overridden per call) without rewriting the function body.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_xero_snapshot_runs(
  _retention_days integer DEFAULT 90,
  _abandoned_hours integer DEFAULT 24
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  DELETE FROM public.xero_snapshot_runs
   WHERE (finished_at IS NOT NULL
          AND finished_at < now() - make_interval(days => _retention_days))
      OR (status = 'running'
          AND started_at < now() - make_interval(hours => _abandoned_hours));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_xero_snapshot_runs(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_xero_snapshot_runs(integer, integer) TO service_role;