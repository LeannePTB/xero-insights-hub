-- Read side: no table-level SELECT, column-level SELECT on non-sensitive columns only.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.xero_connections FROM authenticated;
REVOKE ALL ON public.xero_connections FROM anon;

GRANT SELECT (
  id, user_id, tenant_id, tenant_name, tenant_type, expires_at, scopes,
  created_at, updated_at, firm_id, status, disconnected_at, base_currency
) ON public.xero_connections TO authenticated;

-- Stale column-level grants from an earlier state.
REVOKE SELECT (access_token_enc, refresh_token_enc, enc_version) ON public.xero_connections FROM authenticated;
REVOKE UPDATE, INSERT ON public.xero_connections FROM authenticated;

-- Policy roles only: expressions byte-identical to the existing definitions.
DROP POLICY "Users manage own xero connections" ON public.xero_connections;
CREATE POLICY "Users manage own xero connections" ON public.xero_connections
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY "firm members read firm xero connections" ON public.xero_connections;
CREATE POLICY "firm members read firm xero connections" ON public.xero_connections
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((firm_id IS NOT NULL) AND app_private.has_firm_access(auth.uid(), firm_id)));

DROP POLICY "firm owners manage firm xero connections" ON public.xero_connections;
CREATE POLICY "firm owners manage firm xero connections" ON public.xero_connections
  AS PERMISSIVE FOR ALL TO authenticated
  USING (((firm_id IS NOT NULL) AND app_private.is_firm_owner(auth.uid(), firm_id)))
  WITH CHECK (((firm_id IS NOT NULL) AND app_private.is_firm_owner(auth.uid(), firm_id)));