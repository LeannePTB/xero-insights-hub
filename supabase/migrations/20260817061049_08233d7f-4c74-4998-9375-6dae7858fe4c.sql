DROP POLICY IF EXISTS "Owners insert support access" ON public.firm_support_access;
DROP POLICY IF EXISTS "Owners update support access" ON public.firm_support_access;

CREATE POLICY "Owners or super admins insert support access"
ON public.firm_support_access
FOR INSERT
TO authenticated
WITH CHECK (
  app_private.is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.firms f WHERE f.id = firm_support_access.firm_id AND f.owner_user_id = auth.uid())
);

CREATE POLICY "Owners or super admins update support access"
ON public.firm_support_access
FOR UPDATE
TO authenticated
USING (
  app_private.is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.firms f WHERE f.id = firm_support_access.firm_id AND f.owner_user_id = auth.uid())
)
WITH CHECK (
  app_private.is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.firms f WHERE f.id = firm_support_access.firm_id AND f.owner_user_id = auth.uid())
);