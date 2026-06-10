
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Updated_at helper
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Xero connections
CREATE TABLE public.xero_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  tenant_name TEXT NOT NULL,
  tenant_type TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xero_connections TO authenticated;
GRANT ALL ON public.xero_connections TO service_role;
ALTER TABLE public.xero_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own xero connections" ON public.xero_connections
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER xero_connections_set_updated_at BEFORE UPDATE ON public.xero_connections
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- OAuth state (short-lived, per attempt)
CREATE TABLE public.xero_oauth_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_verifier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xero_oauth_states TO authenticated;
GRANT ALL ON public.xero_oauth_states TO service_role;
ALTER TABLE public.xero_oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own oauth states" ON public.xero_oauth_states
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Dashboard config
CREATE TABLE public.dashboard_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id TEXT,
  layout JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_configs TO authenticated;
GRANT ALL ON public.dashboard_configs TO service_role;
ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own dashboard configs" ON public.dashboard_configs
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER dashboard_configs_set_updated_at BEFORE UPDATE ON public.dashboard_configs
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Report cache
CREATE TABLE public.report_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  report_key TEXT NOT NULL,
  params_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, report_key, params_hash)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_cache TO authenticated;
GRANT ALL ON public.report_cache TO service_role;
ALTER TABLE public.report_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own report cache" ON public.report_cache
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
