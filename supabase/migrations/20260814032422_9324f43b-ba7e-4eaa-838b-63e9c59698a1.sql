CREATE TABLE public.loan_consolidation_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.consolidation_groups(id) ON DELETE CASCADE,
  as_at date NOT NULL,
  label text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX loan_consolidation_snapshots_group_idx
  ON public.loan_consolidation_snapshots (group_id, generated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_consolidation_snapshots TO authenticated;
GRANT ALL ON public.loan_consolidation_snapshots TO service_role;

ALTER TABLE public.loan_consolidation_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Firm people can view loan snapshots"
  ON public.loan_consolidation_snapshots FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consolidation_groups g WHERE g.id = group_id));

CREATE POLICY "Firm people can manage loan snapshots"
  ON public.loan_consolidation_snapshots FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consolidation_groups g WHERE g.id = group_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.consolidation_groups g WHERE g.id = group_id));

CREATE TRIGGER loan_consolidation_snapshots_set_updated_at
  BEFORE UPDATE ON public.loan_consolidation_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();