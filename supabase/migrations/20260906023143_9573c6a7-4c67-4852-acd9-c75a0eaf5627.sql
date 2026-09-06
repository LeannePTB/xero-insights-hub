CREATE OR REPLACE FUNCTION public.set_org_widget_enabled(_firm_id uuid, _tier text, _widget text, _enabled boolean)
 RETURNS TABLE(clients_affected integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
DECLARE _uid uuid := auth.uid(); _n int := 0; _base text[];
BEGIN
  IF _uid IS NULL OR NOT app_private.has_firm_access(_uid, _firm_id) THEN
    RAISE EXCEPTION 'NO_ACCESS' USING errcode='insufficient_privilege';
  END IF;

  SELECT coalesce(
    (SELECT excluded_widgets FROM public.tier_widget_config
      WHERE client_id IS NULL AND firm_id = _firm_id AND tier = _tier),
    (SELECT excluded_widgets FROM public.tier_widget_config
      WHERE client_id IS NULL AND firm_id IS NULL AND tier = _tier),
    '{}'::text[]) INTO _base;

  IF _enabled THEN
    _base := array_remove(_base, _widget);
  ELSE
    _base := (SELECT array(SELECT DISTINCT u FROM unnest(_base || array[_widget]) u));
  END IF;

  INSERT INTO public.tier_widget_config (firm_id, tier, widgets, excluded_widgets)
  VALUES (_firm_id, _tier, '{}', _base)
  ON CONFLICT (firm_id, tier) WHERE client_id IS NULL AND firm_id IS NOT NULL
  DO UPDATE SET excluded_widgets = _base, updated_at = now();

  IF _enabled THEN
    UPDATE public.tier_widget_config t
       SET excluded_widgets = array_remove(t.excluded_widgets, _widget), updated_at = now()
     WHERE t.client_id IN (SELECT id FROM public.clients WHERE firm_id = _firm_id)
       AND t.tier = _tier AND _widget = ANY(t.excluded_widgets);
    GET DIAGNOSTICS _n = ROW_COUNT;
  END IF;

  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, meta)
  VALUES (_uid, _firm_id, 'org_widget_toggled', 'tier_widget_config',
          jsonb_build_object('tier',_tier,'widget',_widget,'enabled',_enabled,
                             'client_overrides_cleared',_n));

  RETURN QUERY SELECT _n;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_all_client_tiers(_firm_id uuid, _tier dashboard_tier, _include_billed boolean DEFAULT false, _reason text DEFAULT NULL::text)
 RETURNS TABLE(changed integer, skipped_billed integer, unchanged integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _c record;
  _sub public.client_subscriptions%ROWTYPE;
  _changed int := 0; _skipped int := 0; _same int := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING errcode='insufficient_privilege';
  END IF;

  IF NOT app_private.has_firm_access(_uid, _firm_id) THEN
    RAISE EXCEPTION 'NO_ACCESS: you cannot manage this organisation'
      USING errcode='insufficient_privilege';
  END IF;

  -- The organisation's plan must permit the tier.
  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    JOIN public.plan_levels p ON p.scope='firm' AND p.key = s.tier
    WHERE s.firm_id = _firm_id AND _tier::text = ANY(p.allowed_tiers)
  ) THEN
    RAISE EXCEPTION 'PLAN_DOES_NOT_PERMIT_TIER: this organisation''s plan does not include the % dashboard', _tier
      USING errcode='check_violation';
  END IF;

  FOR _c IN SELECT id, name FROM public.clients WHERE firm_id = _firm_id LOOP
    SELECT * INTO _sub FROM public.client_subscriptions
     WHERE client_id = _c.id ORDER BY created_at DESC LIMIT 1;

    IF _sub.id IS NOT NULL
       AND _sub.subscription_type IN ('paid','trial')
       AND NOT _include_billed THEN
      _skipped := _skipped + 1;
      CONTINUE;
    END IF;

    IF _sub.id IS NOT NULL AND _sub.dashboard_tier = _tier THEN
      _same := _same + 1;
      CONTINUE;
    END IF;

    IF _sub.id IS NOT NULL THEN
      UPDATE public.client_subscriptions
         SET dashboard_tier = _tier, updated_at = now()
       WHERE id = _sub.id;
    ELSE
      -- No row yet: record it as comped, not paid. Nothing is being charged,
      -- and inventing a 'paid' subscription with no Stripe behind it would
      -- corrupt billing once checkout is wired up.
      INSERT INTO public.client_subscriptions
        (client_id, subscription_type, status, dashboard_tier, comp_reason, comped_by, comped_at)
      VALUES (_c.id, 'free_forever', 'active', _tier,
              COALESCE(_reason,'Bulk tier assignment'), _uid, now());
    END IF;

    INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
    VALUES (_uid, _firm_id, 'client_tier_changed', 'client', _c.id::text,
            jsonb_build_object('client_name', _c.name,
              'from', COALESCE(_sub.dashboard_tier::text,'basic'),
              'to', _tier::text, 'bulk', true, 'reason', _reason));
    _changed := _changed + 1;
  END LOOP;

  RETURN QUERY SELECT _changed, _skipped, _same;
END;
$function$;