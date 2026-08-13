CREATE FUNCTION public.move_xero_file_to_client(
  _connection_id uuid,
  _target_client_id uuid,
  _actor_user_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, app_private
AS $$
  SELECT app_private.move_xero_file_to_client(_connection_id, _target_client_id, _actor_user_id)
$$;
REVOKE ALL ON FUNCTION public.move_xero_file_to_client(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_xero_file_to_client(uuid, uuid, uuid) TO service_role;