-- xero_connections: revoke anon, hide token columns from authenticated Data API
REVOKE ALL ON public.xero_connections FROM anon;
REVOKE SELECT ON public.xero_connections FROM authenticated;
GRANT SELECT (
  id, user_id, tenant_id, tenant_name, tenant_type,
  expires_at, scopes, created_at, updated_at, firm_id, enc_version
) ON public.xero_connections TO authenticated;

-- access_invites: revoke anon, hide token_hash from authenticated Data API
REVOKE ALL ON public.access_invites FROM anon;
REVOKE SELECT ON public.access_invites FROM authenticated;
GRANT SELECT (
  id, firm_id, email, role, invited_by, expires_at, accepted_at, created_at
) ON public.access_invites TO authenticated;

-- tier_widget_config: require authenticated for global read, revoke anon
REVOKE ALL ON public.tier_widget_config FROM anon;
DROP POLICY IF EXISTS "Viewers read accessible tier widget config" ON public.tier_widget_config;
CREATE POLICY "Viewers read accessible tier widget config"
  ON public.tier_widget_config
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND ((client_id IS NULL) OR app_private.has_client_access(auth.uid(), client_id))
  );