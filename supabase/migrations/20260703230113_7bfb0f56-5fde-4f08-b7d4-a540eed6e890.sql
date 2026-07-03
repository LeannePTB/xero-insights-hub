-- Replace the over-broad "advisors manage roles" policy with:
--   1. read-only access for advisors and super admins (needed by admin UI)
--   2. write access restricted to super admins only
DROP POLICY IF EXISTS "advisors manage roles" ON public.user_roles;

CREATE POLICY "advisors read roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (app_private.is_advisor(auth.uid()) OR public.me_is_super_admin());

CREATE POLICY "super admins manage roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.me_is_super_admin())
  WITH CHECK (public.me_is_super_admin());