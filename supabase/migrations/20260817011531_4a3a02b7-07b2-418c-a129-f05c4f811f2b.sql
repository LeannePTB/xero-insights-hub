DROP POLICY IF EXISTS "audit_runs read for staff" ON public.audit_runs;
CREATE POLICY "audit_runs read for firm staff"
ON public.audit_runs
FOR SELECT
TO authenticated
USING (
  app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.firm_members fm
    JOIN public.clients c ON c.firm_id = fm.firm_id
    JOIN public.client_xero_orgs cxo ON cxo.client_id = c.id
    JOIN public.xero_connections xc ON xc.id = cxo.xero_connection_id
    WHERE fm.user_id = auth.uid()
      AND xc.tenant_id = audit_runs.tenant_id
  )
);

DROP POLICY IF EXISTS "audit_findings read for staff" ON public.audit_findings;
CREATE POLICY "audit_findings read for firm staff"
ON public.audit_findings
FOR SELECT
TO authenticated
USING (
  app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.firm_members fm
    JOIN public.clients c ON c.firm_id = fm.firm_id
    JOIN public.client_xero_orgs cxo ON cxo.client_id = c.id
    JOIN public.xero_connections xc ON xc.id = cxo.xero_connection_id
    WHERE fm.user_id = auth.uid()
      AND xc.tenant_id = audit_findings.tenant_id
  )
);

DROP POLICY IF EXISTS "snoozes read for staff" ON public.audit_finding_snoozes;
DROP POLICY IF EXISTS "snoozes write for staff" ON public.audit_finding_snoozes;
CREATE POLICY "snoozes read for firm staff"
ON public.audit_finding_snoozes
FOR SELECT
TO authenticated
USING (
  app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.firm_members fm
    JOIN public.clients c ON c.firm_id = fm.firm_id
    JOIN public.client_xero_orgs cxo ON cxo.client_id = c.id
    JOIN public.xero_connections xc ON xc.id = cxo.xero_connection_id
    WHERE fm.user_id = auth.uid()
      AND xc.tenant_id = audit_finding_snoozes.tenant_id
  )
);
CREATE POLICY "snoozes write for firm staff"
ON public.audit_finding_snoozes
FOR ALL
TO authenticated
USING (
  app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.firm_members fm
    JOIN public.clients c ON c.firm_id = fm.firm_id
    JOIN public.client_xero_orgs cxo ON cxo.client_id = c.id
    JOIN public.xero_connections xc ON xc.id = cxo.xero_connection_id
    WHERE fm.user_id = auth.uid()
      AND xc.tenant_id = audit_finding_snoozes.tenant_id
  )
)
WITH CHECK (
  app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.firm_members fm
    JOIN public.clients c ON c.firm_id = fm.firm_id
    JOIN public.client_xero_orgs cxo ON cxo.client_id = c.id
    JOIN public.xero_connections xc ON xc.id = cxo.xero_connection_id
    WHERE fm.user_id = auth.uid()
      AND xc.tenant_id = audit_finding_snoozes.tenant_id
  )
);

DROP POLICY IF EXISTS "advisors read roles" ON public.user_roles;
CREATE POLICY "super admins read all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.me_is_super_admin());