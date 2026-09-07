CREATE OR REPLACE FUNCTION public.set_client_widget_enabled(_client_id uuid, _widget text, _enabled boolean)
 RETURNS TABLE(effective_tier text, is_enabled boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _tier text;
  _firm uuid;
  _excl text[];
  _in_tier boolean;
BEGIN
  -- Membership-only gate: the caller must own the client or be an active
  -- member of the client's organisation. Deliberately NOT
  -- app_private.user_can_manage_client, which admits read-only support grants.
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NO_ACCESS' USING errcode='insufficient_privilege';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clients c
     WHERE c.id = _client_id
       AND (c.owner_user_id = _uid
            OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(_uid, c.firm_id)))
  ) THEN
    RAISE EXCEPTION 'NO_ACCESS' USING errcode='insufficient_privilege';
  END IF;

  SELECT e.tier::text INTO _tier FROM public.client_entitlement(_client_id) e;
  SELECT c.firm_id INTO _firm FROM public.clients c WHERE c.id = _client_id;

  SELECT (_widget = ANY(pl.widgets)) INTO _in_tier
    FROM public.plan_levels pl
   WHERE pl.scope='dashboard' AND pl.key = _tier AND pl.enabled;

  IF _enabled AND NOT coalesce(_in_tier,false) THEN
    RAISE EXCEPTION 'NOT_IN_TIER: % is not part of the % dashboard', _widget, _tier
      USING errcode='check_violation';
  END IF;

  SELECT coalesce(twc.excluded_widgets,'{}') INTO _excl
    FROM public.tier_widget_config twc
   WHERE twc.client_id = _client_id AND twc.tier = _tier;

  IF _enabled THEN
    _excl := array_remove(coalesce(_excl,'{}'), _widget);
  ELSE
    _excl := (SELECT array(SELECT DISTINCT u FROM unnest(coalesce(_excl,'{}') || array[_widget]) u));
  END IF;

  INSERT INTO public.tier_widget_config (client_id, tier, widgets, excluded_widgets)
  VALUES (_client_id, _tier, '{}', _excl)
  ON CONFLICT (client_id, tier) WHERE client_id IS NOT NULL
  DO UPDATE SET excluded_widgets = _excl, updated_at = now();

  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  VALUES (_uid, _firm, 'client_widget_toggled', 'client', _client_id::text,
          jsonb_build_object('widget',_widget,'enabled',_enabled,'tier',_tier));

  RETURN QUERY SELECT _tier, public.client_can_use_widget(_client_id, _widget);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_client_report(_report_id uuid, _reason text DEFAULT NULL::text)
 RETURNS TABLE(deleted boolean, recipients_revoked integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _r public.client_reports%ROWTYPE;
  _n int := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING errcode='insufficient_privilege';
  END IF;

  SELECT * INTO _r FROM public.client_reports WHERE id = _report_id;
  IF _r.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode='no_data_found';
  END IF;

  -- Membership-only gate: owner of the client, or an active member of its
  -- organisation. Deliberately NOT app_private.user_can_manage_client, which
  -- admits read-only support grants.
  IF NOT EXISTS (
    SELECT 1 FROM public.clients c
     WHERE c.id = _r.client_id
       AND (c.owner_user_id = _uid
            OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(_uid, c.firm_id)))
  ) THEN
    RAISE EXCEPTION 'NO_ACCESS' USING errcode='insufficient_privilege';
  END IF;

  IF _r.status IN ('final','sent') AND NOT app_private.is_super_admin(_uid) THEN
    RAISE EXCEPTION 'REPORT_IS_%: a report that has been finalised or sent can only be deleted by a super admin', upper(_r.status)
      USING errcode='insufficient_privilege';
  END IF;

  UPDATE public.report_recipients
     SET revoked_at = now()
   WHERE report_id = _report_id AND revoked_at IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;

  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  VALUES (_uid, _r.firm_id, 'client_report_deleted', 'client_reports', _report_id::text,
          jsonb_build_object('client_id',_r.client_id,'period_end',_r.period_end,
            'version',_r.version,'status',_r.status,'was_sent_at',_r.sent_at,
            'recipients_revoked',_n,'reason',_reason));

  DELETE FROM public.client_reports WHERE id = _report_id;

  RETURN QUERY SELECT true, _n;
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

  -- Assigning dashboard tiers is an entitlement decision, not bookkeeping:
  -- super admins only.
  IF NOT app_private.is_super_admin(_uid) THEN
    RAISE EXCEPTION 'NO_ACCESS: only Positive Traction can set dashboard tiers'
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