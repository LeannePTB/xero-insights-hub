
-- 1. Xero tokens: remove viewer SELECT policy and revoke token columns from authenticated.
DROP POLICY IF EXISTS "viewers read assigned xero connections" ON public.xero_connections;

REVOKE SELECT (access_token, refresh_token, scopes) ON public.xero_connections FROM authenticated;
REVOKE SELECT (access_token, refresh_token, scopes) ON public.xero_connections FROM anon;

-- 2. Fix mutable search_path on pgmq helper functions.
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
