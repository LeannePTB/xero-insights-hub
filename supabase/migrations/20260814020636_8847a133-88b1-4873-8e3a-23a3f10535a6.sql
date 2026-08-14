ALTER TABLE public.xero_oauth_states
  ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.firms(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.tg_xero_oauth_states_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.flow NOT IN ('connect','signin','onboard') THEN
    RAISE EXCEPTION 'xero_oauth_states.flow must be connect, signin or onboard, got %', NEW.flow;
  END IF;
  IF NEW.flow IN ('connect','onboard') AND NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'xero_oauth_states.user_id is required for % flow', NEW.flow;
  END IF;
  IF NEW.flow = 'onboard' AND NEW.firm_id IS NULL THEN
    RAISE EXCEPTION 'xero_oauth_states.firm_id is required for onboard flow';
  END IF;
  RETURN NEW;
END;
$$;