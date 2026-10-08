-- Allow the Sign Up with Xero flow (Xero App Store certification, 8 Oct 2026).
-- 'signup' is pre-session like 'signin': user_id stays null, no firm/client link.
CREATE OR REPLACE FUNCTION public.tg_xero_oauth_states_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- 'reconnect' reauthorises a Xero organisation that is already linked, to
  -- pick up newly requested scopes. It needs a user like 'connect' does, but
  -- must never be gated by the plan limit — it is not a new Xero file.
  -- 'signup' is the pre-session Sign Up with Xero flow: like 'signin' it has
  -- no user yet, and it never links a firm or client.
  IF NEW.flow NOT IN ('connect','signin','signup','onboard','reconnect') THEN
    RAISE EXCEPTION 'xero_oauth_states.flow must be connect, signin, signup, onboard or reconnect, got %', NEW.flow;
  END IF;
  IF NEW.flow IN ('connect','onboard','reconnect') AND NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'xero_oauth_states.user_id is required for % flow', NEW.flow;
  END IF;
  IF NEW.flow = 'onboard' AND NEW.firm_id IS NULL THEN
    RAISE EXCEPTION 'xero_oauth_states.firm_id is required for onboard flow';
  END IF;
  RETURN NEW;
END;
$function$;