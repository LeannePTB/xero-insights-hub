CREATE OR REPLACE FUNCTION app_private.user_can_manage_client(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = _client_id
      AND c.firm_id IS NOT NULL
      AND app_private.is_firm_owner(_user_id, c.firm_id)
  )
$$;