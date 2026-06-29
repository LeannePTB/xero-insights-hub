-- Allow xero_oauth_states to represent two flows:
--   - 'connect': existing data-connect flow (user_id required)
--   - 'signin' : new Sign In with Xero identity flow (user_id NULL; we discover
--     the user from the Xero id_token after the redirect).
ALTER TABLE public.xero_oauth_states ADD COLUMN IF NOT EXISTS flow TEXT NOT NULL DEFAULT 'connect';
ALTER TABLE public.xero_oauth_states ALTER COLUMN user_id DROP NOT NULL;

-- Defensive: ensure flow is one of the known values via a trigger
-- (CHECK constraints cannot reference future values cleanly, and we want
-- a clear error if a bad row is inserted).
CREATE OR REPLACE FUNCTION public.tg_xero_oauth_states_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.flow NOT IN ('connect','signin') THEN
    RAISE EXCEPTION 'xero_oauth_states.flow must be connect or signin, got %', NEW.flow;
  END IF;
  IF NEW.flow = 'connect' AND NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'xero_oauth_states.user_id is required for connect flow';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS xero_oauth_states_validate ON public.xero_oauth_states;
CREATE TRIGGER xero_oauth_states_validate
BEFORE INSERT OR UPDATE ON public.xero_oauth_states
FOR EACH ROW EXECUTE FUNCTION public.tg_xero_oauth_states_validate();

-- Service role inserts signin-flow rows (no auth.uid); existing RLS policy
-- still scopes authenticated-user access to their own rows.