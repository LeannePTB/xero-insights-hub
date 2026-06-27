CREATE TABLE IF NOT EXISTS public.xero_assessment_contact (
  id text PRIMARY KEY DEFAULT 'singleton',
  legal_name text,
  trading_name text,
  abn_acn text,
  address text,
  website text,
  app_name text,
  xero_client_id text,
  contact_name text,
  contact_role text,
  contact_email text,
  contact_phone text,
  assessment_date text,
  api_usage_description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.xero_assessment_contact TO authenticated;
GRANT ALL ON public.xero_assessment_contact TO service_role;

ALTER TABLE public.xero_assessment_contact ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin read xero_assessment_contact"
  ON public.xero_assessment_contact FOR SELECT TO authenticated
  USING (public.me_is_super_admin());

CREATE POLICY "super_admin write xero_assessment_contact"
  ON public.xero_assessment_contact FOR ALL TO authenticated
  USING (public.me_is_super_admin())
  WITH CHECK (public.me_is_super_admin());

CREATE TRIGGER xero_assessment_contact_set_updated_at
  BEFORE UPDATE ON public.xero_assessment_contact
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed from existing security_contact_details if present, else hardcoded.
INSERT INTO public.xero_assessment_contact (
  id, legal_name, trading_name, abn_acn, address, website, app_name,
  xero_client_id, contact_name, contact_role, contact_email, contact_phone,
  assessment_date, api_usage_description
)
SELECT
  'singleton',
  COALESCE(s.company_legal_name, 'Astro Visual The Trustee for Ardern Family Trust'),
  COALESCE(s.trading_name, 'Positive Traction'),
  COALESCE(s.abn, '64 629 433 886'),
  COALESCE(s.registered_address, '13 Trinity Place, Gleneagle, QLD 4285'),
  COALESCE(s.website, 'https://www.positivetraction.com.au/'),
  COALESCE(s.app_name, 'Traction Advisory'),
  COALESCE(s.xero_client_id, '74AC025B105E4C639FE3CEBAEC3EB428'),
  COALESCE(s.primary_contact_name, 'Leanne Ardern'),
  COALESCE(s.primary_contact_role, 'Director'),
  COALESCE(s.primary_contact_email, 'admin@positivetraction.com.au'),
  COALESCE(s.primary_contact_phone, '0421274073'),
  s.assessment_date,
  s.xero_api_usage
FROM (SELECT * FROM public.security_contact_details LIMIT 1) s
ON CONFLICT (id) DO NOTHING;

-- Fallback insert if security_contact_details is empty.
INSERT INTO public.xero_assessment_contact (
  id, legal_name, trading_name, abn_acn, address, website, app_name,
  xero_client_id, contact_name, contact_role, contact_email, contact_phone
) VALUES (
  'singleton',
  'Astro Visual The Trustee for Ardern Family Trust',
  'Positive Traction',
  '64 629 433 886',
  '13 Trinity Place, Gleneagle, QLD 4285',
  'https://www.positivetraction.com.au/',
  'Traction Advisory',
  '74AC025B105E4C639FE3CEBAEC3EB428',
  'Leanne Ardern',
  'Director',
  'admin@positivetraction.com.au',
  '0421274073'
) ON CONFLICT (id) DO NOTHING;