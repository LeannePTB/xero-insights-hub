
CREATE TABLE public.audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  run_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer,
  error text
);
CREATE INDEX idx_audit_runs_tenant_run_at ON public.audit_runs(tenant_id, run_at DESC);
GRANT SELECT ON public.audit_runs TO authenticated;
GRANT ALL ON public.audit_runs TO service_role;
ALTER TABLE public.audit_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_runs read for staff" ON public.audit_runs FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
         OR app_private.has_role(auth.uid(), 'advisor'::public.app_role)
         OR EXISTS (SELECT 1 FROM public.firm_members fm
                    JOIN public.clients c ON c.firm_id = fm.firm_id
                    JOIN public.client_xero_orgs cxo ON cxo.client_id = c.id
                    JOIN public.xero_connections xc ON xc.id = cxo.xero_connection_id
                    WHERE fm.user_id = auth.uid() AND xc.tenant_id = audit_runs.tenant_id));

CREATE TABLE public.audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.audit_runs(id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  rule_id text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('high','medium','low')),
  title text NOT NULL,
  message text NOT NULL,
  entity_type text,
  entity_id text,
  deep_link text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  finding_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_findings_run ON public.audit_findings(run_id);
CREATE INDEX idx_audit_findings_tenant ON public.audit_findings(tenant_id);
GRANT SELECT ON public.audit_findings TO authenticated;
GRANT ALL ON public.audit_findings TO service_role;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_findings read for staff" ON public.audit_findings FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
         OR app_private.has_role(auth.uid(), 'advisor'::public.app_role)
         OR EXISTS (SELECT 1 FROM public.firm_members fm
                    JOIN public.clients c ON c.firm_id = fm.firm_id
                    JOIN public.client_xero_orgs cxo ON cxo.client_id = c.id
                    JOIN public.xero_connections xc ON xc.id = cxo.xero_connection_id
                    WHERE fm.user_id = auth.uid() AND xc.tenant_id = audit_findings.tenant_id));

CREATE TABLE public.audit_finding_snoozes (
  tenant_id text NOT NULL,
  finding_key text NOT NULL,
  snoozed_until timestamptz,
  snoozed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, finding_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_finding_snoozes TO authenticated;
GRANT ALL ON public.audit_finding_snoozes TO service_role;
ALTER TABLE public.audit_finding_snoozes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snoozes read for staff" ON public.audit_finding_snoozes FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
         OR app_private.has_role(auth.uid(), 'advisor'::public.app_role));
CREATE POLICY "snoozes write for staff" ON public.audit_finding_snoozes FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
         OR app_private.has_role(auth.uid(), 'advisor'::public.app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
              OR app_private.has_role(auth.uid(), 'advisor'::public.app_role));
