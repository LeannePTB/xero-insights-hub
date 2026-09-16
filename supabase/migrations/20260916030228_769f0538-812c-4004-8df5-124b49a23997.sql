CREATE OR REPLACE FUNCTION public.client_setup_account_counts(_client_ids uuid[])
RETURNS TABLE (client_id uuid, expense_accounts integer, classified_accounts integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id,
    COALESCE((
      SELECT count(DISTINCT lower(trim(a->>'Name')))::int
      FROM public.xero_snapshots s
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.payload->'Accounts', '[]'::jsonb)) a
      WHERE s.client_id = c.id
        AND s.report_key = 'accounts'
        AND upper(a->>'Class') = 'EXPENSE'
        AND upper(a->>'Status') = 'ACTIVE'
    ), 0),
    COALESCE((
      SELECT count(DISTINCT lower(trim(cc.account_name)))::int
      FROM public.client_cost_classifications cc
      WHERE cc.client_id = c.id
        AND cc.classification IS NOT NULL
        AND cc.classification <> ''
    ), 0)
  FROM public.clients c
  WHERE c.id = ANY(_client_ids);
$$;

REVOKE ALL ON FUNCTION public.client_setup_account_counts(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.client_setup_account_counts(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.client_setup_account_counts(uuid[]) TO authenticated, service_role;