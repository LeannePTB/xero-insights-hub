
-- Enums
CREATE TYPE public.app_role AS ENUM ('advisor', 'client_viewer');
CREATE TYPE public.dashboard_tier AS ENUM ('basic', 'advisory', 'investigate');

-- user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_advisor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'advisor')
$$;

-- clients
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER clients_set_updated_at BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- client_xero_orgs
CREATE TABLE public.client_xero_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  xero_connection_id uuid NOT NULL REFERENCES public.xero_connections(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, xero_connection_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_xero_orgs TO authenticated;
GRANT ALL ON public.client_xero_orgs TO service_role;
ALTER TABLE public.client_xero_orgs ENABLE ROW LEVEL SECURITY;

-- client_access
CREATE TABLE public.client_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier public.dashboard_tier NOT NULL DEFAULT 'basic',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_access TO authenticated;
GRANT ALL ON public.client_access TO service_role;
ALTER TABLE public.client_access ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER client_access_set_updated_at BEFORE UPDATE ON public.client_access
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Security definer: does user have access to client?
CREATE OR REPLACE FUNCTION public.has_client_access(_user_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_access WHERE user_id = _user_id AND client_id = _client_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_access(_user_id uuid, _tenant_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_access ca
    JOIN public.client_xero_orgs cxo ON cxo.client_id = ca.client_id
    JOIN public.xero_connections xc ON xc.id = cxo.xero_connection_id
    WHERE ca.user_id = _user_id AND xc.tenant_id = _tenant_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_tier(_user_id uuid, _tenant_id text)
RETURNS public.dashboard_tier LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ca.tier
  FROM public.client_access ca
  JOIN public.client_xero_orgs cxo ON cxo.client_id = ca.client_id
  JOIN public.xero_connections xc ON xc.id = cxo.xero_connection_id
  WHERE ca.user_id = _user_id AND xc.tenant_id = _tenant_id
  ORDER BY CASE ca.tier WHEN 'investigate' THEN 3 WHEN 'advisory' THEN 2 ELSE 1 END DESC
  LIMIT 1
$$;

-- Policies: user_roles
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT
TO authenticated USING (user_id = auth.uid() OR public.is_advisor(auth.uid()));
CREATE POLICY "advisors manage roles" ON public.user_roles FOR ALL
TO authenticated USING (public.is_advisor(auth.uid())) WITH CHECK (public.is_advisor(auth.uid()));

-- Policies: clients
CREATE POLICY "advisors manage clients" ON public.clients FOR ALL
TO authenticated USING (public.is_advisor(auth.uid())) WITH CHECK (public.is_advisor(auth.uid()));
CREATE POLICY "viewers read assigned clients" ON public.clients FOR SELECT
TO authenticated USING (public.has_client_access(auth.uid(), id));

-- Policies: client_xero_orgs
CREATE POLICY "advisors manage client xero orgs" ON public.client_xero_orgs FOR ALL
TO authenticated USING (public.is_advisor(auth.uid())) WITH CHECK (public.is_advisor(auth.uid()));
CREATE POLICY "viewers read assigned client xero orgs" ON public.client_xero_orgs FOR SELECT
TO authenticated USING (public.has_client_access(auth.uid(), client_id));

-- Policies: client_access
CREATE POLICY "advisors manage client access" ON public.client_access FOR ALL
TO authenticated USING (public.is_advisor(auth.uid())) WITH CHECK (public.is_advisor(auth.uid()));
CREATE POLICY "viewers read own access" ON public.client_access FOR SELECT
TO authenticated USING (user_id = auth.uid());

-- Extend xero_connections so viewers can SELECT linked orgs
CREATE POLICY "viewers read assigned xero connections" ON public.xero_connections FOR SELECT
TO authenticated USING (public.has_tenant_access(auth.uid(), tenant_id));

-- handle_new_user: first user becomes advisor, others client_viewer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email));

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'advisor') THEN
    v_role := 'advisor';
  ELSE
    v_role := 'client_viewer';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  RETURN NEW;
END;
$$;

-- Backfill: existing users -> advisor (since they connected Xero already)
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT user_id, 'advisor'::public.app_role FROM public.xero_connections
ON CONFLICT DO NOTHING;

-- Backfill: clients from existing xero_connections (one client per connection)
WITH ins AS (
  INSERT INTO public.clients (name, owner_user_id)
  SELECT tenant_name, user_id FROM public.xero_connections
  RETURNING id, name, owner_user_id
)
INSERT INTO public.client_xero_orgs (client_id, xero_connection_id)
SELECT ins.id, xc.id
FROM ins
JOIN public.xero_connections xc ON xc.tenant_name = ins.name AND xc.user_id = ins.owner_user_id;
