
-- 1. PKCE: stop overloading code_verifier with the return origin.
ALTER TABLE public.xero_oauth_states
  ADD COLUMN IF NOT EXISTS return_origin text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes');

-- 2. Allow plaintext xero token columns to be NULL while we migrate to AES-256-GCM.
ALTER TABLE public.xero_connections
  ALTER COLUMN access_token DROP NOT NULL,
  ALTER COLUMN refresh_token DROP NOT NULL;

-- 3. Audit log: explicitly forbid UPDATE/DELETE from the app role. INSERT/SELECT only.
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM authenticated, anon, PUBLIC;
GRANT INSERT, SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

-- 4. Block app-side UPDATE/DELETE on xero_oauth_states (single-use rows).
REVOKE UPDATE ON public.xero_oauth_states FROM authenticated, anon, PUBLIC;
