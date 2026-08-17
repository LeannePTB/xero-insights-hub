CREATE OR REPLACE VIEW public.admin_firm_overview AS
  SELECT f.id AS firm_id,
     f.name AS firm_name,
     f.is_always_free,
     f.created_at AS firm_created_at,
     s.tier,
     s.status,
     s.trial_ends_at,
     s.current_period_end,
     s.cancel_at_period_end,
     COALESCE(xc.connection_count, 0) AS connection_count,
     COALESCE(be.recent_error_count, 0) AS recent_error_count
    FROM public.firms f
      LEFT JOIN public.subscriptions s ON s.firm_id = f.id
      LEFT JOIN LATERAL ( SELECT count(*)::integer AS connection_count
             FROM public.xero_connections xc_1
            WHERE xc_1.firm_id = f.id) xc ON true
      LEFT JOIN LATERAL ( SELECT count(*)::integer AS recent_error_count
             FROM public.billing_events be_1
            WHERE be_1.firm_id = f.id AND be_1.type LIKE '%failed%' AND be_1.occurred_at > (now() - '7 days'::interval)) be ON true;

GRANT SELECT ON public.admin_firm_overview TO authenticated;
GRANT ALL ON public.admin_firm_overview TO service_role;

ALTER VIEW public.admin_firm_overview SET (security_invoker = on);