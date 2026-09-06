REVOKE ALL ON public.xero_snapshots FROM anon;
REVOKE ALL ON public.xero_snapshot_runs FROM anon;
REVOKE INSERT ON public.audit_log FROM authenticated;