CREATE OR REPLACE FUNCTION public.client_setup_account_counts(_client_ids uuid[])
 RETURNS TABLE(client_id uuid, expense_accounts integer, classified_accounts integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH chart AS (
    SELECT c.id AS cid, lower(trim(a->>'Name')) AS nm
    FROM public.clients c
    JOIN public.xero_snapshots s ON s.client_id = c.id AND s.report_key = 'accounts'
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.payload->'Accounts', '[]'::jsonb)) a
    WHERE c.id = ANY(_client_ids)
      AND upper(a->>'Class') = 'EXPENSE'
      AND upper(a->>'Status') = 'ACTIVE'
      AND COALESCE(trim(a->>'Name'), '') <> ''
  ),
  pnl AS (
    SELECT c.id AS cid, lower(trim((r->'Cells'->0)->>'Value')) AS nm
    FROM public.clients c
    JOIN public.xero_snapshots s ON s.client_id = c.id
      AND s.report_key IN ('profit_and_loss_ytd', 'profit_and_loss_mtd', 'profit_and_loss_prior')
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.payload->'Reports', '[]'::jsonb)) rep
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(rep->'Rows', '[]'::jsonb)) sect
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sect->'Rows', '[]'::jsonb)) r
    WHERE c.id = ANY(_client_ids)
      AND r->>'RowType' = 'Row'
      AND COALESCE(trim((r->'Cells'->0)->>'Value'), '') <> ''
  ),
  countable AS (
    -- Only accounts a person can actually tag: those that appear in the
    -- profit and loss. When no profit and loss has been read for a client,
    -- fall back to the whole chart of accounts (previous behaviour).
    SELECT ch.cid, ch.nm
    FROM chart ch
    WHERE EXISTS (SELECT 1 FROM pnl p WHERE p.cid = ch.cid AND p.nm = ch.nm)
       OR NOT EXISTS (SELECT 1 FROM pnl p WHERE p.cid = ch.cid)
  )
  SELECT
    c.id,
    COALESCE((SELECT count(DISTINCT k.nm)::int FROM countable k WHERE k.cid = c.id), 0),
    COALESCE((
      SELECT count(DISTINCT k.nm)::int
      FROM countable k
      WHERE k.cid = c.id
        AND EXISTS (
          SELECT 1 FROM public.client_cost_classifications cc
          WHERE cc.client_id = c.id
            AND cc.classification IS NOT NULL
            AND cc.classification <> ''
            AND lower(trim(cc.account_name)) = k.nm
        )
    ), 0)
  FROM public.clients c
  WHERE c.id = ANY(_client_ids);
$function$;