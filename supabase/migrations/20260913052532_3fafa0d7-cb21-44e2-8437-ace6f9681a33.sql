-- Batch 3: remove the accidental External adviser writes (Project Knowledge rule 11).
-- scenario_exclusions: members and client owners write through
-- public.user_can_write_client_scenario + the registered admin client, never a
-- direct session write, so these three permissive write policies are removed
-- rather than re-pointed (re-pointing would newly grant members a direct REST write).
DROP POLICY IF EXISTS "Client members manage scenario exclusions (insert)" ON public.scenario_exclusions;
DROP POLICY IF EXISTS "Client members manage scenario exclusions (update)" ON public.scenario_exclusions;
DROP POLICY IF EXISTS "Client members manage scenario exclusions (delete)" ON public.scenario_exclusions;

-- unreconciled_lines: the member/client-owner UPDATE policy already exists
-- ("manage unreconciled lines by firm (update)"), so the viewer policy's read
-- predicate is replaced with the write helper (active member OR client owner).
DROP POLICY IF EXISTS "Viewers can update comments for their client" ON public.unreconciled_lines;
CREATE POLICY "Members update comments for their client"
  ON public.unreconciled_lines
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (app_private.user_can_write_client(auth.uid(), client_id))
  WITH CHECK (app_private.user_can_write_client(auth.uid(), client_id));

-- One rulebook: the scenario write check is membership or client ownership only.
CREATE OR REPLACE FUNCTION public.user_can_write_client_scenario(_client_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _uid uuid := auth.uid();
begin
  perform app_private.assert_aal2();
  if _uid is null then return false; end if;
  return app_private.user_can_write_client(_uid, _client_id);
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.user_can_write_client_scenario(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_write_client_scenario(uuid) TO authenticated, service_role;