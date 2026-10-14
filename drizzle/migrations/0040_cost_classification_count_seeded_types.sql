-- One rule with the screen and calculations (src/lib/cost-classification.ts):
-- a stored tag wins; otherwise Xero type DIRECTCOSTS seeds Variable and
-- OVERHEADS seeds Fixed, so those count as tagged. Read-only, SECURITY INVOKER:
-- counts only rows the caller can already read.
CREATE OR REPLACE FUNCTION public.client_setup_cost_accounts(_client_ids uuid[])
 RETURNS TABLE(client_id uuid, account_name text, account_type text, tagged boolean)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH chart AS (
    SELECT DISTINCT ON (c.id, lower(trim(a->>'Name')))
           c.id AS cid, trim(a->>'Name') AS name, lower(trim(a->>'Name')) AS nm, upper(coalesce(a->>'Type','')) AS typ
    FROM public.clients c
    JOIN public.xero_snapshots s ON s.client_id = c.id AND s.report_key = 'accounts'
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.payload->'Accounts', '[]'::jsonb)) a
    WHERE c.id = ANY(_client_ids)
      AND upper(a->>'Class') = 'EXPENSE'
      AND upper(a->>'Status') = 'ACTIVE'
      AND COALESCE(trim(a->>'Name'), '') <> ''
  ),
  pnl AS (
    SELECT DISTINCT c.id AS cid, lower(trim((r->'Cells'->0)->>'Value')) AS nm
    FROM public.clients c
    JOIN public.xero_snapshots s ON s.client_id = c.id
      AND s.report_key IN ('profit_and_loss_ytd', 'profit_and_loss_mtd', 'profit_and_loss_prior')
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.payload->'Reports', '[]'::jsonb)) rep
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(rep->'Rows', '[]'::jsonb)) sect
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sect->'Rows', '[]'::jsonb)) r
    WHERE c.id = ANY(_client_ids)
      AND r->>'RowType' = 'Row'
      AND COALESCE(trim((r->'Cells'->0)->>'Value'), '') <> ''
  )
  SELECT ch.cid, ch.name, ch.typ,
         ch.typ IN ('DIRECTCOSTS', 'OVERHEADS') OR EXISTS (
           SELECT 1 FROM public.client_cost_classifications cc
           WHERE cc.client_id = ch.cid AND cc.classification IS NOT NULL AND cc.classification <> ''
             AND lower(trim(cc.account_name)) = ch.nm)
  FROM chart ch
  WHERE EXISTS (SELECT 1 FROM pnl p WHERE p.cid = ch.cid AND p.nm = ch.nm)
     OR NOT EXISTS (SELECT 1 FROM pnl p WHERE p.cid = ch.cid);
$function$;
REVOKE EXECUTE ON FUNCTION public.client_setup_cost_accounts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_setup_cost_accounts(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.client_setup_account_counts(_client_ids uuid[])
 RETURNS TABLE(client_id uuid, expense_accounts integer, classified_accounts integer)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  SELECT c.id,
         count(u.account_name)::int,
         count(u.account_name) FILTER (WHERE u.tagged)::int
  FROM public.clients c
  LEFT JOIN public.client_setup_cost_accounts(_client_ids) u ON u.client_id = c.id
  WHERE c.id = ANY(_client_ids)
  GROUP BY c.id;
$function$;
