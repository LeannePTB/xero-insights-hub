CREATE OR REPLACE FUNCTION public.client_setup_cost_accounts(_client_ids uuid[])
 RETURNS TABLE(client_id uuid, account_name text, account_type text, tagged boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- Every active expense account on the stored chart; "tagged" means a person
  -- has confirmed a choice on Account setup. Unconfirmed suggestions count as untagged.
  SELECT DISTINCT ON (c.id, a->>'AccountID')
         c.id, trim(a->>'Name'), upper(coalesce(a->>'Type','')),
         EXISTS (SELECT 1 FROM public.client_account_setup x
                 WHERE x.client_id = c.id AND x.tenant_id = s.tenant_id AND x.confirmed
                   AND x.account_id::text = a->>'AccountID')
  FROM public.clients c
  JOIN public.xero_snapshots s ON s.client_id = c.id AND s.report_key = 'accounts'
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.payload->'Accounts', '[]'::jsonb)) a
  WHERE c.id = ANY(_client_ids)
    AND upper(a->>'Class') = 'EXPENSE'
    AND upper(a->>'Status') = 'ACTIVE'
    AND COALESCE(trim(a->>'Name'), '') <> ''
  ORDER BY c.id, a->>'AccountID', s.fetched_at DESC;
$function$;