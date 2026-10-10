CREATE POLICY mfa_aal2_required
ON public.platform_branding
AS RESTRICTIVE FOR ALL TO authenticated
USING (app_private.is_aal2())
WITH CHECK (app_private.is_aal2());