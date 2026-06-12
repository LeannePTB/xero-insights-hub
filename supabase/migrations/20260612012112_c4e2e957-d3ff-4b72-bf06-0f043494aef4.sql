
-- 1) Hide Xero OAuth tokens from client-side reads (RLS + column grants stack;
--    service_role still has full access via supabaseAdmin for token refresh).
REVOKE SELECT (access_token, refresh_token) ON public.xero_connections FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.xero_connections FROM anon;
-- Also block writes to these columns from the client; tokens are only ever
-- written server-side via the service role during the OAuth callback / refresh.
REVOKE INSERT (access_token, refresh_token), UPDATE (access_token, refresh_token)
  ON public.xero_connections FROM authenticated;
REVOKE INSERT (access_token, refresh_token), UPDATE (access_token, refresh_token)
  ON public.xero_connections FROM anon;

-- 2) login_events: stop clients from inserting arbitrary email/ip/user_agent.
--    Inserts now happen exclusively via the logLogin server function using the
--    service role; advisors keep SELECT via the existing policy.
DROP POLICY IF EXISTS "Users insert their own login event" ON public.login_events;
REVOKE INSERT ON public.login_events FROM authenticated, anon;

-- 3) Lock down SECURITY DEFINER helpers. They are intended for use inside RLS
--    policies and server code only — no need to expose them to anon, and the
--    trigger-only ones don't need to be callable at all from the API roles.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_advisor(uuid)                       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_tenant_access(uuid, text)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_client_access(uuid, uuid)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_tier(uuid, text)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_tier_widgets(uuid, public.dashboard_tier) FROM PUBLIC, anon;

-- Trigger-only functions: revoke from all API roles entirely.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at()  FROM PUBLIC, anon, authenticated;
