UPDATE public.tier_widget_config
SET widgets = (
  SELECT COALESCE(
    array_agg(DISTINCT w ORDER BY w),
    ARRAY[]::text[]
  )
  FROM unnest(
    CASE
      WHEN 'breakeven' = ANY(widgets)
      THEN array_remove(widgets, 'breakeven') || ARRAY['period_performance','accounting_breakeven','true_breakeven']
      ELSE widgets
    END
  ) AS w
)
WHERE 'breakeven' = ANY(widgets);