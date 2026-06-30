ALTER TABLE public.client_cost_classifications
  ADD COLUMN IF NOT EXISTS is_wages boolean NOT NULL DEFAULT false;

UPDATE public.client_cost_classifications
SET is_wages = true,
    classification = 'fixed'
WHERE classification = 'wages';

ALTER TABLE public.client_cost_classifications
  DROP CONSTRAINT IF EXISTS client_cost_classifications_classification_check;

ALTER TABLE public.client_cost_classifications
  ADD CONSTRAINT client_cost_classifications_classification_check
  CHECK (classification IN ('fixed','variable','excluded'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_cost_classifications TO authenticated;
GRANT ALL ON public.client_cost_classifications TO service_role;