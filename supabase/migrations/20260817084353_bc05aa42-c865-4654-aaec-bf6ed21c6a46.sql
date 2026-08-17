-- 1. client_subscriptions: entitlement + comp + offer columns
ALTER TABLE public.client_subscriptions
  ADD COLUMN IF NOT EXISTS dashboard_tier public.dashboard_tier NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS promotion_code text,
  ADD COLUMN IF NOT EXISTS coupon_id text,
  ADD COLUMN IF NOT EXISTS comp_reason text,
  ADD COLUMN IF NOT EXISTS comped_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS comped_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS client_subscriptions_stripe_sub_key
  ON public.client_subscriptions (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS client_subscriptions_client_key
  ON public.client_subscriptions (client_id);

-- 2. billing_events: client link + idempotency
ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS billing_events_stripe_event_id_key
  ON public.billing_events (stripe_event_id);

-- 3. Single entitlement rule, evaluated at read time.
CREATE OR REPLACE FUNCTION public.client_entitlement(_client_id uuid)
RETURNS TABLE (
  tier public.dashboard_tier,
  source text,
  expires_at timestamptz,
  in_grace boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  _uid uuid := auth.uid();
  _firm uuid;
  _always_free boolean := false;
  _sub public.client_subscriptions%ROWTYPE;
  _tier public.dashboard_tier := 'basic';
  _source text := 'none';
  _expires timestamptz := NULL;
  _grace boolean := false;
  _top public.dashboard_tier;
BEGIN
  -- Fail closed: no readable client, no entitlement above free Standard.
  IF _uid IS NULL OR NOT app_private.user_can_read_client(_uid, _client_id) THEN
    RETURN QUERY SELECT 'basic'::public.dashboard_tier, 'none'::text, NULL::timestamptz, false;
    RETURN;
  END IF;

  SELECT c.firm_id INTO _firm FROM public.clients c WHERE c.id = _client_id;
  IF _firm IS NOT NULL THEN
    SELECT f.is_always_free INTO _always_free FROM public.firms f WHERE f.id = _firm;
  END IF;

  SELECT * INTO _sub
  FROM public.client_subscriptions s
  WHERE s.client_id = _client_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF COALESCE(_always_free, false) THEN
    -- The practice's own organisation: highest dashboard level the catalogue still enables.
    SELECT l.key::public.dashboard_tier INTO _top
    FROM public.plan_levels l
    LEFT JOIN public.tier_settings ts ON ts.tier = l.key
    WHERE l.scope = 'dashboard'
      AND l.enabled
      AND COALESCE(ts.enabled, true)
      AND l.key IN ('basic','advisory','investigate','multi_company')
    ORDER BY l.sort_order DESC
    LIMIT 1;
    _tier := COALESCE(_top, 'basic');
    _source := 'org_always_free';
  ELSIF _sub.id IS NOT NULL THEN
    IF _sub.subscription_type = 'free_forever' THEN
      _tier := 'basic';
      _source := 'free_forever';
    ELSIF _sub.subscription_type = 'trial' THEN
      IF _sub.trial_end IS NOT NULL AND _sub.trial_end > now() THEN
        _tier := _sub.dashboard_tier;
        _source := 'trial';
        _expires := _sub.trial_end;
      END IF;  -- expired trial silently falls back to basic / none
    ELSIF _sub.subscription_type = 'paid' THEN
      IF _sub.status IN ('active', 'trialing', 'free_forever') THEN
        _tier := _sub.dashboard_tier;
        _source := 'paid';
        _expires := _sub.current_period_end;
      ELSIF _sub.status = 'past_due'
        AND _sub.current_period_end IS NOT NULL
        AND _sub.current_period_end > now() THEN
        _tier := _sub.dashboard_tier;
        _source := 'paid';
        _expires := _sub.current_period_end;
        _grace := true;
      END IF;  -- cancelled or lapsed falls back to basic / none
    END IF;
  END IF;

  -- Global kill switch: a disabled level never grants anything above Standard.
  IF _tier <> 'basic' AND EXISTS (
    SELECT 1 FROM public.tier_settings ts WHERE ts.tier = _tier::text AND ts.enabled = false
  ) THEN
    _tier := 'basic';
    _source := 'none';
    _expires := NULL;
    _grace := false;
  END IF;

  RETURN QUERY SELECT _tier, _source, _expires, _grace;
END;
$$;

REVOKE ALL ON FUNCTION public.client_entitlement(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.client_entitlement(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.client_entitlement(uuid) TO authenticated, service_role;

-- 4. Policies on client_subscriptions only.
--    Billing identifiers must not reach invited client viewers.
DROP POLICY IF EXISTS "firm members read client subscriptions" ON public.client_subscriptions;

CREATE POLICY "managers read client subscriptions"
  ON public.client_subscriptions FOR SELECT TO authenticated
  USING (
    app_private.user_can_manage_client(auth.uid(), client_id)
    OR app_private.is_super_admin(auth.uid())
  );

CREATE POLICY "super admins manage client subscriptions"
  ON public.client_subscriptions FOR ALL TO authenticated
  USING (app_private.is_super_admin(auth.uid()))
  WITH CHECK (app_private.is_super_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_subscriptions TO authenticated;
GRANT ALL ON public.client_subscriptions TO service_role;