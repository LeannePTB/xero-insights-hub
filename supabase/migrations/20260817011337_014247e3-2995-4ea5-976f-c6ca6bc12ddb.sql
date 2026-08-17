DROP POLICY IF EXISTS "Advisors can manage tier settings" ON public.tier_settings;

CREATE POLICY "Super admins can manage tier settings"
ON public.tier_settings
FOR ALL
TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::public.app_role));