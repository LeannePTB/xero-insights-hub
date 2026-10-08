DROP POLICY "MFA required for income tax instalments" ON public.client_income_tax_instalments;
CREATE POLICY mfa_aal2_required
ON public.client_income_tax_instalments
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (app_private.is_aal2())
WITH CHECK (app_private.is_aal2());