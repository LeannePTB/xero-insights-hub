CREATE OR REPLACE FUNCTION public.change_firm_plan(_firm_id uuid, _plan_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _level public.plan_levels%ROWTYPE;
  _clients integer;
  _files integer;
  _existing public.subscriptions%ROWTYPE;
BEGIN
  IF _uid IS NULL OR NOT app_private.is_super_admin(_uid) THEN
    RAISE EXCEPTION 'NO_ACCESS';
  END IF;

  SELECT * INTO _level
    FROM public.plan_levels l
   WHERE l.scope = 'firm' AND l.key = _plan_key;

  IF _level.id IS NULL OR NOT _level.enabled THEN
    RAISE EXCEPTION 'That plan is not available.';
  END IF;

  SELECT count(*) INTO _clients FROM public.clients c WHERE c.firm_id = _firm_id;
  IF _clients > COALESCE(_level.client_limit, 0) THEN
    RAISE EXCEPTION 'This organisation has % client(s) but % allows %. Remove clients first, or pick a larger plan.',
      _clients, _level.label, COALESCE(_level.client_limit, 0);
  END IF;

  SELECT count(*) INTO _files
    FROM public.xero_connections x
   WHERE x.firm_id = _firm_id AND x.status = 'connected';
  IF _files > COALESCE(_level.xero_org_limit, _level.client_limit, 0) THEN
    RAISE EXCEPTION 'This organisation has % Xero organisation(s) but % allows %. Disconnect files first, or pick a larger plan.',
      _files, _level.label, COALESCE(_level.xero_org_limit, _level.client_limit, 0);
  END IF;

  SELECT * INTO _existing FROM public.subscriptions s WHERE s.firm_id = _firm_id;

  IF _existing.id IS NOT NULL THEN
    UPDATE public.subscriptions
       SET tier = _plan_key,
           client_limit_override = NULL,
           cancel_at_period_end = false,
           updated_at = now()
     WHERE id = _existing.id;
  ELSE
    INSERT INTO public.subscriptions (firm_id, tier, status, client_limit_override, cancel_at_period_end)
    VALUES (_firm_id, _plan_key, 'active', NULL, false);
  END IF;

  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  VALUES (
    _uid,
    _firm_id,
    'subscription_plan_changed',
    'firm',
    _firm_id::text,
    jsonb_build_object('from', _existing.tier, 'to', _plan_key, 'by_super_admin', true)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.change_firm_plan(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_firm_plan(uuid, text) TO authenticated;