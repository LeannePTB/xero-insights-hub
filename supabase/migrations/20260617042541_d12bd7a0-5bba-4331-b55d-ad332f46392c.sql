
-- 1) Drop super_admin ALL policy on clients (admin paths use service role / admin_firm_overview view).
DROP POLICY IF EXISTS "super admins manage all clients" ON public.clients;

-- 2) Tighten login_events policy: advisors see only events for users sharing one of their firms; users always see their own.
DROP POLICY IF EXISTS "Advisors view all login events" ON public.login_events;

CREATE OR REPLACE FUNCTION app_private.shares_firm_with(_viewer uuid, _subject uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.firm_members vm
    JOIN public.firm_members sm ON sm.firm_id = vm.firm_id
    WHERE vm.user_id = _viewer AND sm.user_id = _subject
  )
$$;

CREATE POLICY "Users read own login events"
  ON public.login_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Advisors read same-firm login events"
  ON public.login_events FOR SELECT
  TO authenticated
  USING (
    app_private.is_advisor(auth.uid())
    AND user_id IS NOT NULL
    AND app_private.shares_firm_with(auth.uid(), user_id)
  );

-- 3) Hide invite token hash from data API for non-service roles.
REVOKE SELECT (token_hash) ON public.access_invites FROM authenticated;
REVOKE SELECT (token_hash) ON public.access_invites FROM anon;

-- 4) Hide legacy plaintext Xero tokens from data API for non-service roles.
REVOKE SELECT (access_token, refresh_token) ON public.xero_connections FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.xero_connections FROM anon;
REVOKE UPDATE (access_token, refresh_token) ON public.xero_connections FROM authenticated;
REVOKE UPDATE (access_token, refresh_token) ON public.xero_connections FROM anon;
REVOKE INSERT (access_token, refresh_token) ON public.xero_connections FROM authenticated;
REVOKE INSERT (access_token, refresh_token) ON public.xero_connections FROM anon;
