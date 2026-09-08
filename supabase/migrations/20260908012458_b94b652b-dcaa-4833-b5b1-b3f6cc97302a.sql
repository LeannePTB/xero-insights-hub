REVOKE ALL ON public.client_statutory_accounts FROM anon;

DROP POLICY "Manage statutory accounts by firm" ON public.client_statutory_accounts;

CREATE POLICY "Manage statutory accounts by firm"
ON public.client_statutory_accounts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_statutory_accounts.client_id
      AND (
        c.owner_user_id = auth.uid()
        OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_statutory_accounts.client_id
      AND (
        c.owner_user_id = auth.uid()
        OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id))
      )
  )
);