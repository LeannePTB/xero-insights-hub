CREATE OR REPLACE FUNCTION public.tg_xero_oauth_states_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
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