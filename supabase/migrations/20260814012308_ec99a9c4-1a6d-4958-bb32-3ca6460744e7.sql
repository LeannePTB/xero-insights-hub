DELETE FROM public.plan_levels WHERE scope = 'dashboard' AND key = 'multi_company';

UPDATE public.plan_levels p
SET allowed_tiers = ARRAY(
  SELECT k FROM unnest(p.allowed_tiers) k
  WHERE k IN (SELECT key FROM public.plan_levels WHERE scope = 'dashboard')
)
WHERE p.scope = 'firm';

DELETE FROM public.tier_settings
WHERE tier NOT IN (SELECT key FROM public.plan_levels WHERE scope = 'dashboard');

DELETE FROM public.tier_widget_config
WHERE tier NOT IN (SELECT key FROM public.plan_levels WHERE scope = 'dashboard');