CREATE TABLE public.client_rental_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  name text NOT NULL,
  match_type text NOT NULL,
  match_ids text[] NOT NULL,
  expected_amount numeric(14,2) NOT NULL,
  frequency text NOT NULL,
  lease_start date,
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_rental_properties_name_valid CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT client_rental_properties_match_type_valid CHECK (match_type IN ('account','tracking','contact')),
  CONSTRAINT client_rental_properties_match_ids_valid CHECK (cardinality(match_ids) BETWEEN 1 AND 20),
  CONSTRAINT client_rental_properties_frequency_valid CHECK (frequency IN ('weekly','fortnightly','monthly')),
  CONSTRAINT client_rental_properties_amount_valid CHECK (expected_amount > 0 AND expected_amount <= 999999999.99)
);

REVOKE ALL ON public.client_rental_properties FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.client_rental_properties TO authenticated;
GRANT ALL ON public.client_rental_properties TO service_role;

ALTER TABLE public.client_rental_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read rental properties"
ON public.client_rental_properties
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_rental_properties.client_id
      AND (
        c.owner_user_id = auth.uid()
        OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id))
      )
  )
);

CREATE POLICY "Client access reads rental properties"
ON public.client_rental_properties
FOR SELECT TO authenticated
USING (app_private.has_client_read_access(auth.uid(), client_id));

CREATE POLICY "Support reads rental properties"
ON public.client_rental_properties
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_rental_properties.client_id
      AND c.firm_id IS NOT NULL
      AND app_private.platform_staff_can_access_firm(auth.uid(), c.firm_id)
  )
);

CREATE POLICY mfa_aal2_required
ON public.client_rental_properties
AS RESTRICTIVE FOR ALL TO authenticated
USING (app_private.is_aal2())
WITH CHECK (app_private.is_aal2());

CREATE INDEX client_rental_properties_lookup
ON public.client_rental_properties (client_id, tenant_id);

CREATE TRIGGER client_rental_properties_set_updated_at
BEFORE UPDATE ON public.client_rental_properties
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.can_manage_client_rental_properties(_client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
BEGIN
  PERFORM app_private.assert_aal2();
  IF _actor IS NULL OR _client_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN coalesce(app_private.user_can_write_client(_actor, _client_id), false);
END;
$function$;
REVOKE ALL ON FUNCTION public.can_manage_client_rental_properties(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_client_rental_properties(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_client_rental_property(
  _id uuid,
  _client_id uuid,
  _tenant_id text,
  _name text,
  _match_type text,
  _match_ids text[],
  _expected_amount numeric,
  _frequency text,
  _lease_start date
)
RETURNS public.client_rental_properties
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _firm_id uuid;
  _saved public.client_rental_properties;
  _mid text;
BEGIN
  PERFORM app_private.assert_aal2();
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF _client_id IS NULL OR _tenant_id IS NULL OR btrim(_tenant_id) = '' THEN
    RAISE EXCEPTION 'INVALID_CLIENT_OR_XERO_FILE' USING ERRCODE = '22023';
  END IF;
  IF _name IS NULL OR char_length(btrim(_name)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'INVALID_PROPERTY_NAME' USING ERRCODE = '22023';
  END IF;
  IF _match_type NOT IN ('account','tracking','contact') THEN
    RAISE EXCEPTION 'INVALID_MATCH_TYPE' USING ERRCODE = '22023';
  END IF;
  IF _match_ids IS NULL OR cardinality(_match_ids) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'INVALID_MATCH_IDS' USING ERRCODE = '22023';
  END IF;
  FOREACH _mid IN ARRAY _match_ids LOOP
    IF _mid IS NULL OR _mid !~ '^[A-Za-z0-9-]{1,64}$' THEN
      RAISE EXCEPTION 'INVALID_MATCH_IDS' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF _frequency NOT IN ('weekly','fortnightly','monthly') THEN
    RAISE EXCEPTION 'INVALID_FREQUENCY' USING ERRCODE = '22023';
  END IF;
  IF _expected_amount IS NULL OR _expected_amount <= 0 OR _expected_amount > 999999999.99
     OR round(_expected_amount, 2) <> _expected_amount THEN
    RAISE EXCEPTION 'INVALID_EXPECTED_RENT' USING ERRCODE = '22023';
  END IF;

  IF NOT coalesce(app_private.user_can_write_client(_actor, _client_id), false) THEN
    RAISE EXCEPTION 'CLIENT_RENTAL_PROPERTY_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  PERFORM public.assert_tenant_belongs_to_client(_client_id, _tenant_id);

  SELECT c.firm_id INTO _firm_id FROM public.clients c WHERE c.id = _client_id;

  IF _id IS NULL THEN
    INSERT INTO public.client_rental_properties (
      client_id, tenant_id, name, match_type, match_ids, expected_amount,
      frequency, lease_start, created_by, updated_by
    ) VALUES (
      _client_id, btrim(_tenant_id), btrim(_name), _match_type, _match_ids,
      _expected_amount, _frequency, _lease_start, _actor, _actor
    ) RETURNING * INTO _saved;
  ELSE
    UPDATE public.client_rental_properties
       SET name = btrim(_name), match_type = _match_type, match_ids = _match_ids,
           expected_amount = _expected_amount, frequency = _frequency,
           lease_start = _lease_start, updated_by = _actor
     WHERE id = _id AND client_id = _client_id AND tenant_id = btrim(_tenant_id)
     RETURNING * INTO _saved;
    IF _saved.id IS NULL THEN
      RAISE EXCEPTION 'RENTAL_PROPERTY_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  VALUES (_actor, _firm_id, 'client_rental_property_saved', 'client', _client_id::text,
          jsonb_build_object('tenant_id', btrim(_tenant_id), 'property_id', _saved.id));

  RETURN _saved;
END;
$function$;
REVOKE ALL ON FUNCTION public.save_client_rental_property(uuid, uuid, text, text, text, text[], numeric, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_client_rental_property(uuid, uuid, text, text, text, text[], numeric, text, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_client_rental_property(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _row public.client_rental_properties;
  _firm_id uuid;
BEGIN
  PERFORM app_private.assert_aal2();
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _row FROM public.client_rental_properties WHERE id = _id;
  IF _row.id IS NULL
     OR NOT coalesce(app_private.user_can_write_client(_actor, _row.client_id), false) THEN
    RAISE EXCEPTION 'CLIENT_RENTAL_PROPERTY_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT c.firm_id INTO _firm_id FROM public.clients c WHERE c.id = _row.client_id;
  DELETE FROM public.client_rental_properties WHERE id = _id;
  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  VALUES (_actor, _firm_id, 'client_rental_property_deleted', 'client', _row.client_id::text,
          jsonb_build_object('tenant_id', _row.tenant_id, 'property_id', _id));
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.delete_client_rental_property(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_client_rental_property(uuid) TO authenticated, service_role;