CREATE OR REPLACE VIEW public.admin_firm_overview AS
SELECT
  f.id AS firm_id,
  f.name AS firm_name,
  f.is_always_free,
  f.created_at AS firm_created_at,
  s.tier,
  s.status,
  s.trial_ends_at,
  s.current_period_end,
  s.cancel_at_period_end,
  COALESCE(xc.connection_count, 0) AS connection_count,
  COALESCE(err.recent_error_count, 0) AS recent_error_count
FROM public.firms f
LEFT JOIN public.subscriptions s ON s.firm_id = f.id
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS connection_count
  FROM public.xero_connections connection
  WHERE connection.firm_id = f.id
) xc ON true
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS recent_error_count
  FROM public.audit_log event
  WHERE event.at >= now() - interval '7 days'
    AND (
      event.action ILIKE '%error%'
      OR event.action ILIKE '%failed%'
      OR event.action ILIKE '%failure%'
    )
    AND (
      event.firm_id = f.id
      OR (
        event.target_type = 'xero_connection'
        AND EXISTS (
          SELECT 1
          FROM public.xero_connections connection
          WHERE connection.id::text = event.target_id
            AND connection.firm_id = f.id
        )
      )
      OR event.meta ->> 'firm_id' = f.id::text
    )
) err ON true;

GRANT SELECT ON public.admin_firm_overview TO authenticated;
GRANT ALL ON public.admin_firm_overview TO service_role;
ALTER VIEW public.admin_firm_overview SET (security_invoker = on);