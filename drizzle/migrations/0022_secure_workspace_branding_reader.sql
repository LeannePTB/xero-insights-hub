REVOKE EXECUTE ON FUNCTION public.workspace_branding_for_firm(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.workspace_branding_for_client(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.workspace_branding_for_firm_v2(_firm_id uuid)
RETURNS TABLE(firm_id uuid, organisation_name text, white_label_enabled boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM app_private.assert_aal2();
  IF auth.uid() IS NULL OR NOT app_private.has_firm_access(auth.uid(), _firm_id) THEN
    RAISE EXCEPTION 'NO_ACCESS' USING errcode = 'insufficient_privilege';
  END IF;
  RETURN QUERY SELECT f.id, f.name, app_private.firm_white_label_enabled(f.id)
  FROM public.firms f WHERE f.id = _firm_id;
END
$function$;
REVOKE ALL ON FUNCTION public.workspace_branding_for_firm_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_branding_for_firm_v2(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.workspace_branding_for_client_v2(_client_id uuid)
RETURNS TABLE(firm_id uuid, organisation_name text, white_label_enabled boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _firm_id uuid;
BEGIN
  PERFORM app_private.assert_aal2();
  IF auth.uid() IS NULL OR NOT app_private.user_can_read_client(auth.uid(), _client_id) THEN
    RAISE EXCEPTION 'NO_ACCESS' USING errcode = 'insufficient_privilege';
  END IF;
  SELECT c.firm_id INTO _firm_id FROM public.clients c WHERE c.id = _client_id;
  RETURN QUERY SELECT f.id, f.name, app_private.firm_white_label_enabled(f.id)
  FROM public.firms f WHERE f.id = _firm_id;
END
$function$;
REVOKE ALL ON FUNCTION public.workspace_branding_for_client_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_branding_for_client_v2(uuid) TO authenticated, service_role;