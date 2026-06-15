
-- Helpers
CREATE OR REPLACE FUNCTION app_private.user_can_manage_client(_user_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_private.is_super_admin(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = _client_id
          AND c.firm_id IS NOT NULL
          AND app_private.is_firm_owner(_user_id, c.firm_id)
      )
$$;

CREATE OR REPLACE FUNCTION app_private.user_can_read_client(_user_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_private.user_can_manage_client(_user_id, _client_id)
      OR app_private.has_client_access(_user_id, _client_id)
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = _client_id
          AND c.firm_id IS NOT NULL
          AND app_private.has_firm_access(_user_id, c.firm_id)
      )
$$;

-- clients
DROP POLICY IF EXISTS "advisors manage clients" ON public.clients;
CREATE POLICY "super admins manage all clients" ON public.clients
  FOR ALL TO authenticated
  USING (app_private.is_super_admin(auth.uid()))
  WITH CHECK (app_private.is_super_admin(auth.uid()));

-- client_xero_orgs
DROP POLICY IF EXISTS "advisors manage client xero orgs" ON public.client_xero_orgs;
CREATE POLICY "manage client xero orgs by firm" ON public.client_xero_orgs
  FOR ALL TO authenticated
  USING (app_private.user_can_manage_client(auth.uid(), client_id))
  WITH CHECK (app_private.user_can_manage_client(auth.uid(), client_id));

-- client_access
DROP POLICY IF EXISTS "advisors manage client access" ON public.client_access;
CREATE POLICY "manage client access by firm" ON public.client_access
  FOR ALL TO authenticated
  USING (app_private.user_can_manage_client(auth.uid(), client_id))
  WITH CHECK (app_private.user_can_manage_client(auth.uid(), client_id));

-- client_notes
DROP POLICY IF EXISTS "Advisors manage all notes" ON public.client_notes;
CREATE POLICY "manage client notes by firm" ON public.client_notes
  FOR ALL TO authenticated
  USING (app_private.user_can_manage_client(auth.uid(), client_id))
  WITH CHECK (app_private.user_can_manage_client(auth.uid(), client_id));

-- tier_widget_config (client_id may be NULL = global default; only super-admin manages global)
DROP POLICY IF EXISTS "Advisors manage tier widget config" ON public.tier_widget_config;
CREATE POLICY "manage tier widget config by firm or super admin" ON public.tier_widget_config
  FOR ALL TO authenticated
  USING (
    (client_id IS NULL AND app_private.is_super_admin(auth.uid()))
    OR (client_id IS NOT NULL AND app_private.user_can_manage_client(auth.uid(), client_id))
  )
  WITH CHECK (
    (client_id IS NULL AND app_private.is_super_admin(auth.uid()))
    OR (client_id IS NOT NULL AND app_private.user_can_manage_client(auth.uid(), client_id))
  );

-- unreconciled_uploads
DROP POLICY IF EXISTS "Advisors manage all uploads" ON public.unreconciled_uploads;
CREATE POLICY "manage unreconciled uploads by firm" ON public.unreconciled_uploads
  FOR ALL TO authenticated
  USING (app_private.user_can_manage_client(auth.uid(), client_id))
  WITH CHECK (app_private.user_can_manage_client(auth.uid(), client_id));

-- unreconciled_lines
DROP POLICY IF EXISTS "Advisors manage all lines" ON public.unreconciled_lines;
CREATE POLICY "manage unreconciled lines by firm" ON public.unreconciled_lines
  FOR ALL TO authenticated
  USING (app_private.user_can_manage_client(auth.uid(), client_id))
  WITH CHECK (app_private.user_can_manage_client(auth.uid(), client_id));
