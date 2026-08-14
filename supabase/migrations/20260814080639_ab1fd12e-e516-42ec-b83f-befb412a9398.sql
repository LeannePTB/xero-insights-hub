-- 1. Client management is organisation-scoped again.
CREATE OR REPLACE FUNCTION app_private.user_can_manage_client(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT app_private.is_super_admin(_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = _client_id
          AND (
            c.owner_user_id = _user_id
            OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(_user_id, c.firm_id))
          )
      )
$function$;

-- 2. Consolidation groups: membership of that organisation only.
DROP POLICY IF EXISTS "Firm people can manage consolidation groups" ON public.consolidation_groups;
DROP POLICY IF EXISTS "Firm people can view consolidation groups" ON public.consolidation_groups;

CREATE POLICY "Firm people can view consolidation groups"
ON public.consolidation_groups FOR SELECT TO authenticated
USING (public.me_is_super_admin() OR app_private.has_firm_access(auth.uid(), firm_id));

CREATE POLICY "Firm people can manage consolidation groups"
ON public.consolidation_groups FOR ALL TO authenticated
USING (public.me_is_super_admin() OR app_private.has_firm_access(auth.uid(), firm_id))
WITH CHECK (public.me_is_super_admin() OR app_private.has_firm_access(auth.uid(), firm_id));

DROP POLICY IF EXISTS "Firm people can manage consolidation group members" ON public.consolidation_group_members;
DROP POLICY IF EXISTS "Firm people can view consolidation group members" ON public.consolidation_group_members;

CREATE POLICY "Firm people can view consolidation group members"
ON public.consolidation_group_members FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.consolidation_groups g
  WHERE g.id = consolidation_group_members.group_id
    AND (public.me_is_super_admin() OR app_private.has_firm_access(auth.uid(), g.firm_id))
));

CREATE POLICY "Firm people can manage consolidation group members"
ON public.consolidation_group_members FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.consolidation_groups g
  WHERE g.id = consolidation_group_members.group_id
    AND (public.me_is_super_admin() OR app_private.has_firm_access(auth.uid(), g.firm_id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.consolidation_groups g
  WHERE g.id = consolidation_group_members.group_id
    AND (public.me_is_super_admin() OR app_private.has_firm_access(auth.uid(), g.firm_id))
));

-- 3. Loan accounts: no blanket advisor allowance.
DROP POLICY IF EXISTS "firm owners and advisors manage loan accounts" ON public.loan_consolidation_accounts;

CREATE POLICY "firm people manage loan accounts"
ON public.loan_consolidation_accounts FOR ALL TO authenticated
USING (app_private.user_can_manage_client(auth.uid(), client_id))
WITH CHECK (app_private.user_can_manage_client(auth.uid(), client_id));

-- 4. Loan snapshots: were open to any signed-in user.
DROP POLICY IF EXISTS "Firm people can manage loan snapshots" ON public.loan_consolidation_snapshots;
DROP POLICY IF EXISTS "Firm people can view loan snapshots" ON public.loan_consolidation_snapshots;

CREATE POLICY "Firm people can view loan snapshots"
ON public.loan_consolidation_snapshots FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.consolidation_groups g
  WHERE g.id = loan_consolidation_snapshots.group_id
    AND (public.me_is_super_admin() OR app_private.has_firm_access(auth.uid(), g.firm_id))
));

CREATE POLICY "Firm people can manage loan snapshots"
ON public.loan_consolidation_snapshots FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.consolidation_groups g
  WHERE g.id = loan_consolidation_snapshots.group_id
    AND (public.me_is_super_admin() OR app_private.has_firm_access(auth.uid(), g.firm_id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.consolidation_groups g
  WHERE g.id = loan_consolidation_snapshots.group_id
    AND (public.me_is_super_admin() OR app_private.has_firm_access(auth.uid(), g.firm_id))
));