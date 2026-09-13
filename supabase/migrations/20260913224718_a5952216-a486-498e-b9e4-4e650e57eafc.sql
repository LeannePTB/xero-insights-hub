CREATE OR REPLACE FUNCTION public.client_xero_files_used(_client_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  perform app_private.assert_aal2();
  if _client_id is null then
    return 0;
  end if;
  if auth.uid() is not null and not app_private.user_can_read_client(auth.uid(), _client_id) then
    raise exception 'Not authorised for this client.';
  end if;
  return app_private.client_xero_files_used(_client_id);
end;
$function$;