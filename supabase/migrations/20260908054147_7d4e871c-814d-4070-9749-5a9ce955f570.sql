CREATE OR REPLACE FUNCTION public.client_removal_impact(_client_id uuid)
RETURNS TABLE(group_count integer, referencing_clients text[])
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NO_ACCESS' USING errcode='insufficient_privilege';
  END IF;

  IF NOT app_private.is_super_admin(_uid)
     AND NOT EXISTS (
       SELECT 1 FROM public.clients c
        WHERE c.id = _client_id
          AND (c.owner_user_id = _uid
               OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(_uid, c.firm_id)))
     ) THEN
    RAISE EXCEPTION 'NO_ACCESS' USING errcode='insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*)::int
       FROM public.consolidation_group_members m
      WHERE m.client_id = _client_id),
    COALESCE((
      SELECT array_agg(DISTINCT oc.name)
        FROM public.loan_consolidation_accounts other
        JOIN public.loan_consolidation_accounts mine
          ON mine.id = other.counterparty_account_id
        JOIN public.clients oc ON oc.id = other.client_id
       WHERE mine.client_id = _client_id
         AND other.client_id <> _client_id
    ), '{}'::text[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_client(_client_id uuid)
RETURNS TABLE(groups_removed integer, pairings_cleared integer, referencing_clients text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _firm_id uuid;
  _name text;
  _groups int := 0;
  _pairs int := 0;
  _names text[] := '{}'::text[];
  _group_names text[] := '{}'::text[];
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NO_ACCESS' USING errcode='insufficient_privilege';
  END IF;

  SELECT c.firm_id, c.name INTO _firm_id, _name
    FROM public.clients c WHERE c.id = _client_id;
  IF _name IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode='no_data_found';
  END IF;

  IF NOT app_private.is_super_admin(_uid)
     AND NOT EXISTS (
       SELECT 1 FROM public.clients c
        WHERE c.id = _client_id
          AND (c.owner_user_id = _uid
               OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(_uid, c.firm_id)))
     ) THEN
    RAISE EXCEPTION 'NO_ACCESS' USING errcode='insufficient_privilege';
  END IF;

  -- Names of the other clients whose loan accounts are matched to this one,
  -- captured before the references are cleared.
  SELECT COALESCE(array_agg(DISTINCT oc.name), '{}'::text[]) INTO _names
    FROM public.loan_consolidation_accounts other
    JOIN public.loan_consolidation_accounts mine
      ON mine.id = other.counterparty_account_id
    JOIN public.clients oc ON oc.id = other.client_id
   WHERE mine.client_id = _client_id
     AND other.client_id <> _client_id;

  SELECT COALESCE(array_agg(g.name), '{}'::text[]) INTO _group_names
    FROM public.consolidation_group_members m
    JOIN public.consolidation_groups g ON g.id = m.group_id
   WHERE m.client_id = _client_id;

  -- 1. Unmatch other clients' loan accounts. Their rows stay; only the
  --    pairing to this client's account is cleared.
  UPDATE public.loan_consolidation_accounts o
     SET counterparty_account_id = NULL,
         updated_at = now()
   WHERE o.client_id <> _client_id
     AND o.counterparty_account_id IN (
       SELECT a.id FROM public.loan_consolidation_accounts a
        WHERE a.client_id = _client_id
     );
  GET DIAGNOSTICS _pairs = ROW_COUNT;

  -- 2. Remove the client from any consolidation groups.
  DELETE FROM public.consolidation_group_members m WHERE m.client_id = _client_id;
  GET DIAGNOSTICS _groups = ROW_COUNT;

  -- 3. Record what was cleared elsewhere, then remove the client.
  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  VALUES (_uid, _firm_id, 'client_removed', 'client', _client_id::text,
          jsonb_build_object(
            'client_name', _name,
            'loan_pairings_cleared', _pairs,
            'loan_pairing_clients', _names,
            'consolidation_groups_removed', _groups,
            'consolidation_group_names', _group_names));

  DELETE FROM public.clients WHERE id = _client_id;

  RETURN QUERY SELECT _groups, _pairs, _names;
END;
$$;