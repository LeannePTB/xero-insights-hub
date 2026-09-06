CREATE OR REPLACE FUNCTION public.reset_org_tier_widgets(_firm_id uuid, _tier text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT app_private.has_firm_access(_uid, _firm_id) THEN
    RAISE EXCEPTION 'NO_ACCESS' USING errcode='insufficient_privilege';
  END IF;

  DELETE FROM public.tier_widget_config
   WHERE firm_id = _firm_id
     AND tier = _tier
     AND client_id IS NULL;

  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, meta)
  VALUES (_uid, _firm_id, 'org_widget_toggled', 'tier_widget_config',
          jsonb_build_object('tier', _tier, 'reset_to_platform_default', true));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reset_org_tier_widgets(uuid, text) TO authenticated;