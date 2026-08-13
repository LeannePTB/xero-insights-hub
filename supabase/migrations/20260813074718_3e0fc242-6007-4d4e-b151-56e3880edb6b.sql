CREATE TABLE public.consolidation_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consolidation_groups TO authenticated;
GRANT ALL ON public.consolidation_groups TO service_role;

ALTER TABLE public.consolidation_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Firm people can view consolidation groups"
ON public.consolidation_groups FOR SELECT TO authenticated
USING (
  public.me_is_super_admin()
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'advisor')
  OR EXISTS (SELECT 1 FROM public.firm_members fm WHERE fm.firm_id = consolidation_groups.firm_id AND fm.user_id = auth.uid())
);

CREATE POLICY "Firm people can manage consolidation groups"
ON public.consolidation_groups FOR ALL TO authenticated
USING (
  public.me_is_super_admin()
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'advisor')
  OR EXISTS (SELECT 1 FROM public.firm_members fm WHERE fm.firm_id = consolidation_groups.firm_id AND fm.user_id = auth.uid())
)
WITH CHECK (
  public.me_is_super_admin()
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'advisor')
  OR EXISTS (SELECT 1 FROM public.firm_members fm WHERE fm.firm_id = consolidation_groups.firm_id AND fm.user_id = auth.uid())
);

CREATE TRIGGER consolidation_groups_set_updated_at
BEFORE UPDATE ON public.consolidation_groups
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.consolidation_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.consolidation_groups(id) ON DELETE CASCADE,
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX consolidation_group_members_group_idx ON public.consolidation_group_members(group_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consolidation_group_members TO authenticated;
GRANT ALL ON public.consolidation_group_members TO service_role;

ALTER TABLE public.consolidation_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Firm people can view consolidation group members"
ON public.consolidation_group_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.consolidation_groups g
    WHERE g.id = consolidation_group_members.group_id
      AND (
        public.me_is_super_admin()
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'advisor')
        OR EXISTS (SELECT 1 FROM public.firm_members fm WHERE fm.firm_id = g.firm_id AND fm.user_id = auth.uid())
      )
  )
);

CREATE POLICY "Firm people can manage consolidation group members"
ON public.consolidation_group_members FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.consolidation_groups g
    WHERE g.id = consolidation_group_members.group_id
      AND (
        public.me_is_super_admin()
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'advisor')
        OR EXISTS (SELECT 1 FROM public.firm_members fm WHERE fm.firm_id = g.firm_id AND fm.user_id = auth.uid())
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.consolidation_groups g
    WHERE g.id = consolidation_group_members.group_id
      AND (
        public.me_is_super_admin()
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'advisor')
        OR EXISTS (SELECT 1 FROM public.firm_members fm WHERE fm.firm_id = g.firm_id AND fm.user_id = auth.uid())
      )
  )
);