CREATE TABLE public.tier_settings (
  tier public.dashboard_tier PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tier_settings TO authenticated;
GRANT ALL ON public.tier_settings TO service_role;

ALTER TABLE public.tier_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read tier settings"
ON public.tier_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Advisors can manage tier settings"
ON public.tier_settings FOR ALL
TO authenticated
USING (public.is_advisor(auth.uid()))
WITH CHECK (public.is_advisor(auth.uid()));

CREATE TRIGGER tier_settings_set_updated_at
BEFORE UPDATE ON public.tier_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.tier_settings (tier, enabled) VALUES
  ('basic', true),
  ('advisory', true),
  ('investigate', true),
  ('multi_company', true)
ON CONFLICT (tier) DO NOTHING;