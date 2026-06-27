CREATE TABLE public.security_contact_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true,
  company_legal_name text,
  trading_name text,
  abn text,
  registered_address text,
  website text,
  app_name text,
  xero_client_id text,
  primary_contact_name text,
  primary_contact_role text,
  primary_contact_email text,
  primary_contact_phone text,
  xero_api_usage text,
  assessment_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT security_contact_details_singleton_chk CHECK (singleton = true),
  CONSTRAINT security_contact_details_singleton_uniq UNIQUE (singleton)
);

GRANT ALL ON public.security_contact_details TO service_role;

ALTER TABLE public.security_contact_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny all to app roles"
  ON public.security_contact_details
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE TRIGGER security_contact_details_set_updated_at
  BEFORE UPDATE ON public.security_contact_details
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();