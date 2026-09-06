-- xero_connections: replace the two FOR ALL policies with FOR SELECT, identical USING expressions and names.
DROP POLICY "Users manage own xero connections" ON public.xero_connections;
CREATE POLICY "Users manage own xero connections"
  ON public.xero_connections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY "firm owners manage firm xero connections" ON public.xero_connections;
CREATE POLICY "firm owners manage firm xero connections"
  ON public.xero_connections
  FOR SELECT
  TO authenticated
  USING ((firm_id IS NOT NULL) AND app_private.is_firm_owner(auth.uid(), firm_id));

-- xero_oauth_states: retarget the single policy from PUBLIC to authenticated, qualifier unchanged.
DROP POLICY "Users manage own oauth states" ON public.xero_oauth_states;
CREATE POLICY "Users manage own oauth states"
  ON public.xero_oauth_states
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);