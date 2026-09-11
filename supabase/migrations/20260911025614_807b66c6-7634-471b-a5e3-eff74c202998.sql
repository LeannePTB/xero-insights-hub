-- Phase 2 guardrails: record access-test runs and surface them on the posture card.

CREATE TABLE public.security_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  ran_by uuid REFERENCES auth.users(id),
  layer text NOT NULL CHECK (layer IN ('pglite','live')),
  passed integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  known_failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  fingerprint_match boolean NOT NULL DEFAULT true,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.security_test_runs FROM PUBLIC;
REVOKE ALL ON public.security_test_runs FROM anon;
GRANT SELECT ON public.security_test_runs TO authenticated;
GRANT ALL ON public.security_test_runs TO service_role;

ALTER TABLE public.security_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mfa_aal2_required" ON public.security_test_runs
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (app_private.is_aal2()) WITH CHECK (app_private.is_aal2());

CREATE POLICY "Super admins read access test runs" ON public.security_test_runs
  FOR SELECT TO authenticated
  USING (app_private.me_is_super_admin());

CREATE INDEX security_test_runs_ran_at_idx ON public.security_test_runs (ran_at DESC);

-- Recording a run is super-admin + aal2 only; the table itself takes no writes.
CREATE OR REPLACE FUNCTION public.record_access_test_run(
  _layer text,
  _passed integer,
  _failed integer,
  _known_failures jsonb,
  _fingerprint_match boolean,
  _details jsonb DEFAULT '[]'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
declare
  new_id uuid;
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  if _layer not in ('pglite','live') then
    raise exception 'INVALID_LAYER' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.security_test_runs
    (ran_by, layer, passed, failed, known_failures, fingerprint_match, details)
  values
    (auth.uid(), _layer, greatest(_passed,0), greatest(_failed,0),
     coalesce(_known_failures,'[]'::jsonb), coalesce(_fingerprint_match,true),
     coalesce(_details,'[]'::jsonb))
  returning id into new_id;

  return new_id;
end;
$$;

REVOKE ALL ON FUNCTION public.record_access_test_run(text,integer,integer,jsonb,boolean,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_access_test_run(text,integer,integer,jsonb,boolean,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_access_test_run(text,integer,integer,jsonb,boolean,jsonb) TO authenticated;