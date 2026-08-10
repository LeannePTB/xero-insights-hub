ALTER TABLE public.plan_levels ADD COLUMN IF NOT EXISTS allowed_tiers text[] NOT NULL DEFAULT '{}';

UPDATE public.plan_levels SET allowed_tiers = ARRAY['basic'] WHERE scope = 'firm' AND key = 'starter';
UPDATE public.plan_levels SET allowed_tiers = ARRAY['basic','advisory'] WHERE scope = 'firm' AND key = 'growth';
UPDATE public.plan_levels SET allowed_tiers = ARRAY['basic','advisory','investigate'] WHERE scope = 'firm' AND key = 'scale';
UPDATE public.plan_levels SET allowed_tiers = ARRAY['basic','advisory','investigate','multi_company'] WHERE scope = 'firm' AND key IN ('firm','free','legacy');