-- Batch 3 regression fix: scenario_exclusions lost every write path when the
-- three accidental adviser write policies were dropped and nothing replaced
-- them. Re-create them per command, to authenticated, using the write helper
-- (active organisation member OR client owner) — never a read predicate, never
-- FOR ALL. Same shape as unreconciled_lines' "Members update comments" policy.
CREATE POLICY "Members manage scenario exclusions (insert)"
  ON public.scenario_exclusions
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (app_private.user_can_write_client(auth.uid(), client_id));

CREATE POLICY "Members manage scenario exclusions (update)"
  ON public.scenario_exclusions
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (app_private.user_can_write_client(auth.uid(), client_id))
  WITH CHECK (app_private.user_can_write_client(auth.uid(), client_id));

CREATE POLICY "Members manage scenario exclusions (delete)"
  ON public.scenario_exclusions
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (app_private.user_can_write_client(auth.uid(), client_id));

-- The scenario planner also has to read back what it excluded through the
-- caller's own session; the only SELECT policy names the read predicate
-- app_private.has_client_access, which no member or client owner satisfies.
CREATE POLICY "Members read scenario exclusions"
  ON public.scenario_exclusions
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (app_private.user_can_write_client(auth.uid(), client_id));