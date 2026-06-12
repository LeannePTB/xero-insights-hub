-- 1) Column-level restriction on unreconciled_lines for non-admin paths.
-- The existing trigger already blocks viewers from changing other columns,
-- but we also restrict UPDATE at the GRANT level as defense in depth so
-- a direct PostgREST PATCH on financial fields fails at the privilege layer
-- before triggers/RLS are even evaluated.
REVOKE UPDATE ON public.unreconciled_lines FROM authenticated;
GRANT UPDATE (client_comment) ON public.unreconciled_lines TO authenticated;
-- service_role keeps full access for admin paths
GRANT ALL ON public.unreconciled_lines TO service_role;

-- 2) user_roles SELECT policy: drop role enumeration via is_advisor.
-- Server code that needs to enumerate roles uses the admin client.
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
