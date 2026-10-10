CREATE OR REPLACE FUNCTION public.firm_white_label_enabled_service(_firm_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'NO_ACCESS' USING errcode = 'insufficient_privilege';
  END IF;
  RETURN app_private.firm_white_label_enabled(_firm_id);
END
$function$;
REVOKE ALL ON FUNCTION public.firm_white_label_enabled_service(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.firm_white_label_enabled_service(uuid) TO service_role;