ALTER TABLE public.clients
  ADD COLUMN max_xero_orgs integer NOT NULL DEFAULT 1;

ALTER TABLE public.xero_oauth_states
  ADD COLUMN known_tenant_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN pending_tenant_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN completed_at timestamptz;

ALTER TABLE public.client_xero_orgs
  ADD CONSTRAINT client_xero_orgs_connection_unique UNIQUE (xero_connection_id);

CREATE OR REPLACE FUNCTION public.enforce_client_xero_org_allowance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_used integer;
  v_is_multi boolean;
BEGIN
  SELECT c.max_xero_orgs,
         EXISTS (
           SELECT 1
           FROM public.client_access ca
           WHERE ca.client_id = c.id
             AND ca.tier = 'multi_company'
         )
    INTO v_limit, v_is_multi
  FROM public.clients c
  WHERE c.id = NEW.client_id;

  IF v_limit IS NULL THEN
    RAISE EXCEPTION 'Client subscription not found';
  END IF;

  IF NOT v_is_multi THEN
    v_limit := 1;
  END IF;

  SELECT count(*)::integer
    INTO v_used
  FROM public.client_xero_orgs cxo
  WHERE cxo.client_id = NEW.client_id
    AND (TG_OP <> 'UPDATE' OR cxo.id <> NEW.id);

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'This client subscription has reached its Xero file allowance of %', v_limit;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_xero_orgs_enforce_allowance ON public.client_xero_orgs;
CREATE TRIGGER client_xero_orgs_enforce_allowance
BEFORE INSERT OR UPDATE OF client_id, xero_connection_id
ON public.client_xero_orgs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_client_xero_org_allowance();

CREATE OR REPLACE FUNCTION public.enforce_client_max_xero_orgs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used integer;
  v_is_multi boolean;
BEGIN
  IF NEW.max_xero_orgs < 1 THEN
    RAISE EXCEPTION 'Xero file allowance must be at least 1';
  END IF;

  SELECT count(*)::integer
    INTO v_used
  FROM public.client_xero_orgs cxo
  WHERE cxo.client_id = NEW.id;

  SELECT EXISTS (
    SELECT 1
    FROM public.client_access ca
    WHERE ca.client_id = NEW.id
      AND ca.tier = 'multi_company'
  ) INTO v_is_multi;

  IF NOT v_is_multi AND NEW.max_xero_orgs <> 1 THEN
    RAISE EXCEPTION 'Only Multi company subscriptions can allow more than one Xero file';
  END IF;

  IF NEW.max_xero_orgs < v_used THEN
    RAISE EXCEPTION 'Unlink Xero files before reducing the allowance below %', v_used;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_enforce_max_xero_orgs ON public.clients;
CREATE TRIGGER clients_enforce_max_xero_orgs
BEFORE UPDATE OF max_xero_orgs
ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.enforce_client_max_xero_orgs();