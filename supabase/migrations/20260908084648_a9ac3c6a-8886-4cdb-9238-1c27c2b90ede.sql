-- Support access is read-only (spec §7). Nine FOR ALL policies authorised
-- writes through app_private.user_can_manage_client, which includes the
-- Path B support-grant branch. Split each into an identical-expression SELECT
-- policy plus membership-only write policies. user_can_manage_client itself is
-- deliberately NOT changed.

-- ---------------------------------------------------------------- client_access
DROP POLICY "manage client access by firm" ON public.client_access;

CREATE POLICY "manage client access by firm (read)"
ON public.client_access FOR SELECT TO authenticated
USING (app_private.user_can_manage_client(auth.uid(), client_id));

CREATE POLICY "manage client access by firm (insert)"
ON public.client_access FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_access.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

CREATE POLICY "manage client access by firm (update)"
ON public.client_access FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_access.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))))
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_access.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

CREATE POLICY "manage client access by firm (delete)"
ON public.client_access FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_access.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

-- ------------------------------------------------ client_cost_classifications
DROP POLICY "Manage cost classifications by firm" ON public.client_cost_classifications;

CREATE POLICY "Manage cost classifications by firm (read)"
ON public.client_cost_classifications FOR SELECT
USING (app_private.user_can_manage_client(auth.uid(), client_id));

CREATE POLICY "Manage cost classifications by firm (insert)"
ON public.client_cost_classifications FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_cost_classifications.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

CREATE POLICY "Manage cost classifications by firm (update)"
ON public.client_cost_classifications FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_cost_classifications.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))))
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_cost_classifications.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

CREATE POLICY "Manage cost classifications by firm (delete)"
ON public.client_cost_classifications FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_cost_classifications.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

-- ------------------------------------------------------------------ client_notes
DROP POLICY "manage client notes by firm" ON public.client_notes;

CREATE POLICY "manage client notes by firm (read)"
ON public.client_notes FOR SELECT TO authenticated
USING (app_private.user_can_manage_client(auth.uid(), client_id));

CREATE POLICY "manage client notes by firm (insert)"
ON public.client_notes FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_notes.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

CREATE POLICY "manage client notes by firm (update)"
ON public.client_notes FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_notes.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))))
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_notes.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

CREATE POLICY "manage client notes by firm (delete)"
ON public.client_notes FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_notes.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

-- --------------------------------------------------- client_true_breakeven_inputs
DROP POLICY "Manage true breakeven inputs by firm" ON public.client_true_breakeven_inputs;

CREATE POLICY "Manage true breakeven inputs by firm (read)"
ON public.client_true_breakeven_inputs FOR SELECT
USING (app_private.user_can_manage_client(auth.uid(), client_id));

CREATE POLICY "Manage true breakeven inputs by firm (insert)"
ON public.client_true_breakeven_inputs FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_true_breakeven_inputs.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

CREATE POLICY "Manage true breakeven inputs by firm (update)"
ON public.client_true_breakeven_inputs FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_true_breakeven_inputs.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))))
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_true_breakeven_inputs.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

CREATE POLICY "Manage true breakeven inputs by firm (delete)"
ON public.client_true_breakeven_inputs FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_true_breakeven_inputs.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

-- -------------------------------------------------------------- client_xero_orgs
DROP POLICY "manage client xero orgs by firm" ON public.client_xero_orgs;

CREATE POLICY "manage client xero orgs by firm (read)"
ON public.client_xero_orgs FOR SELECT TO authenticated
USING (app_private.user_can_manage_client(auth.uid(), client_id));

CREATE POLICY "manage client xero orgs by firm (insert)"
ON public.client_xero_orgs FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_xero_orgs.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

CREATE POLICY "manage client xero orgs by firm (update)"
ON public.client_xero_orgs FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_xero_orgs.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))))
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_xero_orgs.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

CREATE POLICY "manage client xero orgs by firm (delete)"
ON public.client_xero_orgs FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_xero_orgs.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

-- ------------------------------------------------- loan_consolidation_accounts
DROP POLICY "firm people manage loan accounts" ON public.loan_consolidation_accounts;

CREATE POLICY "firm people manage loan accounts (read)"
ON public.loan_consolidation_accounts FOR SELECT TO authenticated
USING (app_private.user_can_manage_client(auth.uid(), client_id));

CREATE POLICY "firm people manage loan accounts (insert)"
ON public.loan_consolidation_accounts FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = loan_consolidation_accounts.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

CREATE POLICY "firm people manage loan accounts (update)"
ON public.loan_consolidation_accounts FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = loan_consolidation_accounts.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))))
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = loan_consolidation_accounts.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

CREATE POLICY "firm people manage loan accounts (delete)"
ON public.loan_consolidation_accounts FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = loan_consolidation_accounts.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

-- ------------------------------------------------------------ tier_widget_config
-- Two shapes. Client rows (client_id NOT NULL) follow the same split as above.
-- Organisation/platform rows (client_id IS NULL) are Path C metadata and keep
-- their super-admin branch on both read and write, unchanged.
DROP POLICY "manage tier widget config by firm or super admin" ON public.tier_widget_config;

CREATE POLICY "manage tier widget config by firm or super admin (read)"
ON public.tier_widget_config FOR SELECT TO authenticated
USING (((client_id IS NULL) AND app_private.me_is_super_admin()) OR ((client_id IS NOT NULL) AND app_private.user_can_manage_client(auth.uid(), client_id)));

CREATE POLICY "manage tier widget config by firm or super admin (insert)"
ON public.tier_widget_config FOR INSERT TO authenticated
WITH CHECK (((client_id IS NULL) AND app_private.me_is_super_admin()) OR ((client_id IS NOT NULL) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = tier_widget_config.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id))))));

CREATE POLICY "manage tier widget config by firm or super admin (update)"
ON public.tier_widget_config FOR UPDATE TO authenticated
USING (((client_id IS NULL) AND app_private.me_is_super_admin()) OR ((client_id IS NOT NULL) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = tier_widget_config.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id))))))
WITH CHECK (((client_id IS NULL) AND app_private.me_is_super_admin()) OR ((client_id IS NOT NULL) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = tier_widget_config.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id))))));

CREATE POLICY "manage tier widget config by firm or super admin (delete)"
ON public.tier_widget_config FOR DELETE TO authenticated
USING (((client_id IS NULL) AND app_private.me_is_super_admin()) OR ((client_id IS NOT NULL) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = tier_widget_config.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id))))));

-- ----------------------------------------------------------- unreconciled_lines
DROP POLICY "manage unreconciled lines by firm" ON public.unreconciled_lines;

CREATE POLICY "manage unreconciled lines by firm (read)"
ON public.unreconciled_lines FOR SELECT TO authenticated
USING (app_private.user_can_manage_client(auth.uid(), client_id));

CREATE POLICY "manage unreconciled lines by firm (insert)"
ON public.unreconciled_lines FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = unreconciled_lines.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

CREATE POLICY "manage unreconciled lines by firm (update)"
ON public.unreconciled_lines FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = unreconciled_lines.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))))
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = unreconciled_lines.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

CREATE POLICY "manage unreconciled lines by firm (delete)"
ON public.unreconciled_lines FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = unreconciled_lines.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

-- --------------------------------------------------------- unreconciled_uploads
DROP POLICY "manage unreconciled uploads by firm" ON public.unreconciled_uploads;

CREATE POLICY "manage unreconciled uploads by firm (read)"
ON public.unreconciled_uploads FOR SELECT TO authenticated
USING (app_private.user_can_manage_client(auth.uid(), client_id));

CREATE POLICY "manage unreconciled uploads by firm (insert)"
ON public.unreconciled_uploads FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = unreconciled_uploads.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

CREATE POLICY "manage unreconciled uploads by firm (update)"
ON public.unreconciled_uploads FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = unreconciled_uploads.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))))
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = unreconciled_uploads.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));

CREATE POLICY "manage unreconciled uploads by firm (delete)"
ON public.unreconciled_uploads FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = unreconciled_uploads.client_id AND (c.owner_user_id = auth.uid() OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id)))));
