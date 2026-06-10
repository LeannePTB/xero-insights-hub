
CREATE TABLE public.tier_widget_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  tier public.dashboard_tier NOT NULL,
  widgets text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tier_widget_config_global_uniq ON public.tier_widget_config (tier) WHERE client_id IS NULL;
CREATE UNIQUE INDEX tier_widget_config_client_uniq ON public.tier_widget_config (client_id, tier) WHERE client_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tier_widget_config TO authenticated;
GRANT ALL ON public.tier_widget_config TO service_role;

ALTER TABLE public.tier_widget_config ENABLE ROW LEVEL SECURITY;

-- Advisors manage everything
CREATE POLICY "Advisors manage tier widget config"
ON public.tier_widget_config FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'advisor'))
WITH CHECK (public.has_role(auth.uid(), 'advisor'));

-- Viewers can read their own client's config + global defaults
CREATE POLICY "Viewers read accessible tier widget config"
ON public.tier_widget_config FOR SELECT TO authenticated
USING (
  client_id IS NULL
  OR public.has_client_access(auth.uid(), client_id)
);

CREATE TRIGGER tier_widget_config_set_updated_at
BEFORE UPDATE ON public.tier_widget_config
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed global defaults matching current hardcoded TIER_WIDGETS
INSERT INTO public.tier_widget_config (client_id, tier, widgets) VALUES
  (NULL, 'basic', ARRAY['revenue_kpis','tax_liability']),
  (NULL, 'advisory', ARRAY['revenue_kpis','tax_liability','pnl','breakeven']),
  (NULL, 'investigate', ARRAY['revenue_kpis','tax_liability','pnl','breakeven','payables']);

-- Resolver: client override if present, else global, else empty
CREATE OR REPLACE FUNCTION public.get_tier_widgets(_client_id uuid, _tier public.dashboard_tier)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT widgets FROM public.tier_widget_config WHERE client_id = _client_id AND tier = _tier),
    (SELECT widgets FROM public.tier_widget_config WHERE client_id IS NULL AND tier = _tier),
    ARRAY[]::text[]
  )
$$;
