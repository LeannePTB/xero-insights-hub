CREATE OR REPLACE FUNCTION app_private.move_xero_file_to_client(
  _connection_id uuid,
  _target_client_id uuid,
  _actor_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_source_client_id uuid;
  v_source_firm_id uuid;
  v_target_firm_id uuid;
BEGIN
  IF NOT app_private.user_can_manage_client(_actor_user_id, _target_client_id) THEN RAISE EXCEPTION 'You cannot manage the target client subscription'; END IF;
  SELECT cxo.client_id, c.firm_id INTO v_source_client_id, v_source_firm_id
  FROM public.client_xero_orgs cxo JOIN public.clients c ON c.id = cxo.client_id
  WHERE cxo.xero_connection_id = _connection_id FOR UPDATE OF cxo;
  SELECT firm_id INTO v_target_firm_id FROM public.clients WHERE id = _target_client_id;
  IF v_source_client_id IS NULL THEN RAISE EXCEPTION 'That Xero file is no longer linked to another subscription'; END IF;
  IF v_source_client_id = _target_client_id THEN RAISE EXCEPTION 'That Xero file is already linked to this subscription'; END IF;
  IF v_source_firm_id IS DISTINCT FROM v_target_firm_id AND NOT app_private.is_super_admin(_actor_user_id) THEN RAISE EXCEPTION 'Only a platform admin can move a Xero file between organisations'; END IF;
  IF NOT app_private.is_super_admin(_actor_user_id) AND NOT app_private.user_can_manage_client(_actor_user_id, v_source_client_id) THEN RAISE EXCEPTION 'You cannot manage the subscription that currently holds this Xero file'; END IF;
  DELETE FROM public.client_xero_orgs WHERE xero_connection_id = _connection_id;
  INSERT INTO public.client_xero_orgs (client_id, xero_connection_id) VALUES (_target_client_id, _connection_id);
  UPDATE public.xero_connections SET firm_id = v_target_firm_id WHERE id = _connection_id;
END;
$$;
REVOKE ALL ON FUNCTION app_private.move_xero_file_to_client(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.move_xero_file_to_client(uuid, uuid, uuid) TO service_role;
DROP FUNCTION public.move_xero_file_to_client(uuid, uuid, uuid);