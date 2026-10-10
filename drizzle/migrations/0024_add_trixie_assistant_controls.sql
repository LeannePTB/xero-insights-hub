CREATE TABLE public.trixie_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton), enabled boolean NOT NULL DEFAULT true,
 model text NOT NULL DEFAULT 'openai/gpt-6-astra' CHECK (model='openai/gpt-6-astra'),
 default_monthly_allowance integer DEFAULT 100 CHECK(default_monthly_allowance IS NULL OR default_monthly_allowance>0),
 warning_threshold integer NOT NULL DEFAULT 80 CHECK(warning_threshold>0),
 platform_monthly_allowance integer DEFAULT 100 CHECK(platform_monthly_allowance IS NULL OR platform_monthly_allowance>0),
 token_cost_guard_usd numeric(10,2) CHECK(token_cost_guard_usd IS NULL OR token_cost_guard_usd>0),
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid);
REVOKE ALL ON public.trixie_settings FROM anon,authenticated; GRANT ALL ON public.trixie_settings TO service_role;
ALTER TABLE public.trixie_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trixie_settings service select" ON public.trixie_settings FOR SELECT TO service_role USING(true);
CREATE POLICY "trixie_settings service insert" ON public.trixie_settings FOR INSERT TO service_role WITH CHECK(true);
CREATE POLICY "trixie_settings service update" ON public.trixie_settings FOR UPDATE TO service_role USING(true) WITH CHECK(true);
CREATE POLICY "trixie_settings service delete" ON public.trixie_settings FOR DELETE TO service_role USING(true);
CREATE POLICY mfa_aal2_required ON public.trixie_settings AS RESTRICTIVE FOR ALL TO authenticated USING(app_private.is_aal2()) WITH CHECK(app_private.is_aal2());

CREATE TABLE public.trixie_knowledge (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 3 AND 160),
 body text NOT NULL CHECK(char_length(btrim(body)) BETWEEN 10 AND 20000), tags text[] NOT NULL DEFAULT '{}',
 audience text NOT NULL DEFAULT 'all' CHECK(audience IN('all','staff','viewer','platform')), active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_by uuid);
REVOKE ALL ON public.trixie_knowledge FROM anon,authenticated; GRANT ALL ON public.trixie_knowledge TO service_role;
ALTER TABLE public.trixie_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trixie_knowledge service select" ON public.trixie_knowledge FOR SELECT TO service_role USING(true);
CREATE POLICY "trixie_knowledge service insert" ON public.trixie_knowledge FOR INSERT TO service_role WITH CHECK(true);
CREATE POLICY "trixie_knowledge service update" ON public.trixie_knowledge FOR UPDATE TO service_role USING(true) WITH CHECK(true);
CREATE POLICY "trixie_knowledge service delete" ON public.trixie_knowledge FOR DELETE TO service_role USING(true);
CREATE POLICY mfa_aal2_required ON public.trixie_knowledge AS RESTRICTIVE FOR ALL TO authenticated USING(app_private.is_aal2()) WITH CHECK(app_private.is_aal2());
CREATE INDEX trixie_knowledge_audience_idx ON public.trixie_knowledge(active,audience,updated_at DESC);

CREATE TABLE public.trixie_org_limits (firm_id uuid PRIMARY KEY REFERENCES public.firms(id) ON DELETE CASCADE,
 monthly_allowance integer CHECK(monthly_allowance IS NULL OR monthly_allowance>0), updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid);
REVOKE ALL ON public.trixie_org_limits FROM anon,authenticated; GRANT ALL ON public.trixie_org_limits TO service_role;
ALTER TABLE public.trixie_org_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trixie_org_limits service select" ON public.trixie_org_limits FOR SELECT TO service_role USING(true);
CREATE POLICY "trixie_org_limits service insert" ON public.trixie_org_limits FOR INSERT TO service_role WITH CHECK(true);
CREATE POLICY "trixie_org_limits service update" ON public.trixie_org_limits FOR UPDATE TO service_role USING(true) WITH CHECK(true);
CREATE POLICY "trixie_org_limits service delete" ON public.trixie_org_limits FOR DELETE TO service_role USING(true);
CREATE POLICY mfa_aal2_required ON public.trixie_org_limits AS RESTRICTIVE FOR ALL TO authenticated USING(app_private.is_aal2()) WITH CHECK(app_private.is_aal2());

CREATE TABLE public.trixie_usage (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 firm_id uuid REFERENCES public.firms(id) ON DELETE SET NULL, client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
 requested_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, model text NOT NULL, gateway_run_id text,
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN('reserved','completed','failed','denied','cancelled')),
 input_tokens integer CHECK(input_tokens IS NULL OR input_tokens>=0), output_tokens integer CHECK(output_tokens IS NULL OR output_tokens>=0),
 reasoning_tokens integer CHECK(reasoning_tokens IS NULL OR reasoning_tokens>=0), estimated_cost_usd numeric(12,6) CHECK(estimated_cost_usd IS NULL OR estimated_cost_usd>=0), error_code text);
REVOKE ALL ON public.trixie_usage FROM anon,authenticated; GRANT ALL ON public.trixie_usage TO service_role;
ALTER TABLE public.trixie_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trixie_usage service select" ON public.trixie_usage FOR SELECT TO service_role USING(true);
CREATE POLICY "trixie_usage service insert" ON public.trixie_usage FOR INSERT TO service_role WITH CHECK(true);
CREATE POLICY "trixie_usage service update" ON public.trixie_usage FOR UPDATE TO service_role USING(true) WITH CHECK(true);
CREATE POLICY "trixie_usage service delete" ON public.trixie_usage FOR DELETE TO service_role USING(true);
CREATE POLICY mfa_aal2_required ON public.trixie_usage AS RESTRICTIVE FOR ALL TO authenticated USING(app_private.is_aal2()) WITH CHECK(app_private.is_aal2());
CREATE INDEX trixie_usage_firm_month_idx ON public.trixie_usage(firm_id,requested_at DESC);
CREATE INDEX trixie_usage_user_month_idx ON public.trixie_usage(user_id,requested_at DESC);

CREATE OR REPLACE FUNCTION public.trixie_access_context(_client_id uuid DEFAULT NULL,_firm_id uuid DEFAULT NULL,_system boolean DEFAULT false)
RETURNS TABLE(enabled boolean,mode text,audience text,firm_id uuid,client_id uuid,model text,monthly_allowance integer,warning_threshold integer,used integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$
DECLARE u uuid:=auth.uid(); f uuid; m text; a text; en boolean:=true; mdl text:='openai/gpt-6-astra'; dl integer:=100; pl integer:=100; w integer:=80; lim integer; n integer;
BEGIN PERFORM app_private.assert_aal2(); IF u IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT s.enabled,s.model,s.default_monthly_allowance,s.platform_monthly_allowance,s.warning_threshold INTO en,mdl,dl,pl,w FROM public.trixie_settings s WHERE s.singleton;
 en:=COALESCE(en,true); mdl:=COALESCE(mdl,'openai/gpt-6-astra'); w:=COALESCE(w,80);
 IF _system THEN IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF; m:='platform'; a:='platform'; lim:=pl;
 ELSIF _client_id IS NOT NULL THEN IF NOT app_private.user_can_read_client(u,_client_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT c.firm_id INTO f FROM public.clients c WHERE c.id=_client_id; IF f IS NULL THEN RAISE EXCEPTION 'Client unavailable'; END IF; m:='client';
  IF EXISTS(SELECT 1 FROM public.firm_members x WHERE x.firm_id=f AND x.user_id=u AND x.status='active') THEN a:='staff'; ELSE a:='viewer'; END IF;
  SELECT l.monthly_allowance INTO lim FROM public.trixie_org_limits l WHERE l.firm_id=f; IF NOT FOUND THEN lim:=dl; END IF;
 ELSIF _firm_id IS NOT NULL THEN IF NOT EXISTS(SELECT 1 FROM public.firm_members x WHERE x.firm_id=_firm_id AND x.user_id=u AND x.status='active') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  f:=_firm_id;m:='organisation';a:='staff';SELECT l.monthly_allowance INTO lim FROM public.trixie_org_limits l WHERE l.firm_id=f;IF NOT FOUND THEN lim:=dl;END IF;
 ELSE SELECT x.firm_id INTO f FROM public.firm_members x WHERE x.user_id=u AND x.status='active' ORDER BY x.created_at LIMIT 1;
  IF f IS NOT NULL THEN m:='general';a:='staff';SELECT l.monthly_allowance INTO lim FROM public.trixie_org_limits l WHERE l.firm_id=f;IF NOT FOUND THEN lim:=dl;END IF;
  ELSIF app_private.me_is_super_admin() THEN m:='platform';a:='platform';lim:=pl; ELSE RAISE EXCEPTION 'No Trixie workspace is available'; END IF;
 END IF;
 SELECT count(*)::integer INTO n FROM public.trixie_usage q WHERE q.requested_at>=date_trunc('month',now()) AND q.status IN('reserved','completed') AND ((m='platform' AND q.firm_id IS NULL) OR (m<>'platform' AND q.firm_id=f));
 RETURN QUERY SELECT en,m,a,f,_client_id,mdl,lim,w,COALESCE(n,0); END; $$;

CREATE OR REPLACE FUNCTION public.reserve_trixie_usage(_client_id uuid DEFAULT NULL,_firm_id uuid DEFAULT NULL,_system boolean DEFAULT false)
RETURNS TABLE(reservation_id uuid,enabled boolean,mode text,audience text,firm_id uuid,client_id uuid,model text,monthly_allowance integer,warning_threshold integer,used integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='public' AS $$
DECLARE c record; rid uuid; lk text;
BEGIN PERFORM app_private.assert_aal2(); SELECT * INTO c FROM public.trixie_access_context(_client_id,_firm_id,_system); IF NOT c.enabled THEN RAISE EXCEPTION 'Trixie is currently switched off'; END IF;
 lk:=COALESCE(c.firm_id::text,'platform'); PERFORM pg_advisory_xact_lock(hashtextextended('trixie:'||lk,0)); SELECT * INTO c FROM public.trixie_access_context(_client_id,_firm_id,_system);
 IF c.monthly_allowance IS NOT NULL AND c.used>=c.monthly_allowance THEN RAISE EXCEPTION 'TRIXIE_LIMIT_REACHED'; END IF;
 INSERT INTO public.trixie_usage(user_id,firm_id,client_id,model) VALUES(auth.uid(),c.firm_id,c.client_id,c.model) RETURNING id INTO rid;
 RETURN QUERY SELECT rid,c.enabled,c.mode,c.audience,c.firm_id,c.client_id,c.model,c.monthly_allowance,c.warning_threshold,c.used+1; END; $$;

CREATE OR REPLACE FUNCTION public.finalise_trixie_usage(_reservation_id uuid,_status text,_gateway_run_id text DEFAULT NULL,_input_tokens integer DEFAULT NULL,_output_tokens integer DEFAULT NULL,_reasoning_tokens integer DEFAULT NULL,_estimated_cost_usd numeric DEFAULT NULL,_error_code text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='public' AS $$
BEGIN PERFORM app_private.assert_aal2(); IF _status NOT IN('completed','failed','denied','cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 UPDATE public.trixie_usage SET completed_at=now(),status=_status,gateway_run_id=left(_gateway_run_id,200),input_tokens=GREATEST(_input_tokens,0),output_tokens=GREATEST(_output_tokens,0),reasoning_tokens=GREATEST(_reasoning_tokens,0),estimated_cost_usd=GREATEST(_estimated_cost_usd,0),error_code=left(_error_code,80) WHERE id=_reservation_id AND user_id=auth.uid() AND status='reserved'; RETURN FOUND; END; $$;

CREATE OR REPLACE FUNCTION public.search_trixie_knowledge(_query text,_client_id uuid DEFAULT NULL,_firm_id uuid DEFAULT NULL,_system boolean DEFAULT false,_limit integer DEFAULT 6)
RETURNS TABLE(id uuid,title text,body text,tags text[],audience text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$
DECLARE c record; BEGIN PERFORM app_private.assert_aal2(); SELECT * INTO c FROM public.trixie_access_context(_client_id,_firm_id,_system);
 RETURN QUERY SELECT k.id,k.title,k.body,k.tags,k.audience FROM public.trixie_knowledge k WHERE k.active AND k.audience IN('all',c.audience)
 ORDER BY CASE WHEN lower(k.title) LIKE '%'||lower(left(_query,500))||'%' THEN 0 WHEN lower(k.body) LIKE '%'||lower(left(_query,500))||'%' THEN 1 ELSE 2 END,k.updated_at DESC LIMIT LEAST(GREATEST(_limit,1),10); END; $$;

CREATE OR REPLACE FUNCTION public.admin_trixie_settings() RETURNS TABLE(enabled boolean,model text,default_monthly_allowance integer,warning_threshold integer,platform_monthly_allowance integer,token_cost_guard_usd numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$ BEGIN PERFORM app_private.assert_aal2();IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'Forbidden';END IF;
 RETURN QUERY SELECT COALESCE(s.enabled,true),COALESCE(s.model,'openai/gpt-6-astra'),s.default_monthly_allowance,COALESCE(s.warning_threshold,80),s.platform_monthly_allowance,s.token_cost_guard_usd FROM public.trixie_settings s WHERE s.singleton;
 IF NOT FOUND THEN RETURN QUERY SELECT true,'openai/gpt-6-astra'::text,100,80,100,NULL::numeric;END IF;END; $$;
CREATE OR REPLACE FUNCTION public.save_trixie_settings(_enabled boolean,_model text,_default integer,_warning integer,_platform integer,_guard numeric) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='public' AS $$
BEGIN PERFORM app_private.assert_aal2();IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'Forbidden';END IF;IF _model<>'openai/gpt-6-astra' OR _warning<=0 OR (_default IS NOT NULL AND _default<=0) OR (_platform IS NOT NULL AND _platform<=0) OR (_guard IS NOT NULL AND _guard<=0) THEN RAISE EXCEPTION 'Invalid settings';END IF;
 INSERT INTO public.trixie_settings(singleton,enabled,model,default_monthly_allowance,warning_threshold,platform_monthly_allowance,token_cost_guard_usd,updated_at,updated_by) VALUES(true,_enabled,_model,_default,_warning,_platform,_guard,now(),auth.uid()) ON CONFLICT(singleton) DO UPDATE SET enabled=excluded.enabled,model=excluded.model,default_monthly_allowance=excluded.default_monthly_allowance,warning_threshold=excluded.warning_threshold,platform_monthly_allowance=excluded.platform_monthly_allowance,token_cost_guard_usd=excluded.token_cost_guard_usd,updated_at=now(),updated_by=auth.uid();
 INSERT INTO public.audit_log(actor_user_id,action,target_type,target_id,meta) VALUES(auth.uid(),'trixie_settings_updated','trixie_settings','singleton',jsonb_build_object('enabled',_enabled,'model',_model));RETURN true;END; $$;
CREATE OR REPLACE FUNCTION public.admin_trixie_knowledge() RETURNS TABLE(id uuid,title text,body text,tags text[],audience text,active boolean,updated_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$ BEGIN PERFORM app_private.assert_aal2();IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'Forbidden';END IF;RETURN QUERY SELECT k.id,k.title,k.body,k.tags,k.audience,k.active,k.updated_at FROM public.trixie_knowledge k ORDER BY k.updated_at DESC;END; $$;
CREATE OR REPLACE FUNCTION public.save_trixie_article(_id uuid,_title text,_body text,_tags text[],_audience text,_active boolean) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='public' AS $$ DECLARE x uuid:=COALESCE(_id,gen_random_uuid());BEGIN PERFORM app_private.assert_aal2();IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'Forbidden';END IF;IF char_length(btrim(_title)) NOT BETWEEN 3 AND 160 OR char_length(btrim(_body)) NOT BETWEEN 10 AND 20000 OR _audience NOT IN('all','staff','viewer','platform') THEN RAISE EXCEPTION 'Invalid article';END IF;INSERT INTO public.trixie_knowledge(id,title,body,tags,audience,active,created_by,updated_by) VALUES(x,btrim(_title),btrim(_body),COALESCE(_tags,'{}'),_audience,_active,auth.uid(),auth.uid()) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,tags=excluded.tags,audience=excluded.audience,active=excluded.active,updated_at=now(),updated_by=auth.uid();INSERT INTO public.audit_log(actor_user_id,action,target_type,target_id,meta) VALUES(auth.uid(),'trixie_article_saved','trixie_knowledge',x::text,jsonb_build_object('audience',_audience,'active',_active));RETURN x;END; $$;
CREATE OR REPLACE FUNCTION public.admin_trixie_limits() RETURNS TABLE(firm_id uuid,firm_name text,monthly_allowance integer) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$ BEGIN PERFORM app_private.assert_aal2();IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'Forbidden';END IF;RETURN QUERY SELECT f.id,f.name,l.monthly_allowance FROM public.firms f LEFT JOIN public.trixie_org_limits l ON l.firm_id=f.id ORDER BY f.name;END; $$;
CREATE OR REPLACE FUNCTION public.save_trixie_org_limit(_firm_id uuid,_allowance integer) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='public' AS $$ BEGIN PERFORM app_private.assert_aal2();IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'Forbidden';END IF;IF NOT EXISTS(SELECT 1 FROM public.firms f WHERE f.id=_firm_id) OR (_allowance IS NOT NULL AND _allowance<=0) THEN RAISE EXCEPTION 'Invalid allowance';END IF;INSERT INTO public.trixie_org_limits(firm_id,monthly_allowance,updated_at,updated_by) VALUES(_firm_id,_allowance,now(),auth.uid()) ON CONFLICT(firm_id) DO UPDATE SET monthly_allowance=excluded.monthly_allowance,updated_at=now(),updated_by=auth.uid();INSERT INTO public.audit_log(actor_user_id,firm_id,action,target_type,target_id,meta) VALUES(auth.uid(),_firm_id,'trixie_limit_updated','trixie_org_limits',_firm_id::text,jsonb_build_object('monthly_allowance',_allowance));RETURN true;END; $$;
CREATE OR REPLACE FUNCTION public.admin_trixie_usage(_from timestamptz DEFAULT date_trunc('month',now())) RETURNS TABLE(firm_id uuid,firm_name text,questions bigint,input_tokens bigint,output_tokens bigint,reasoning_tokens bigint,estimated_cost_usd numeric,failed bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$ BEGIN PERFORM app_private.assert_aal2();IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'Forbidden';END IF;RETURN QUERY SELECT u.firm_id,COALESCE(f.name,'System Admin'),count(*) FILTER(WHERE u.status='completed'),COALESCE(sum(u.input_tokens),0),COALESCE(sum(u.output_tokens),0),COALESCE(sum(u.reasoning_tokens),0),COALESCE(sum(u.estimated_cost_usd),0),count(*) FILTER(WHERE u.status IN('failed','denied')) FROM public.trixie_usage u LEFT JOIN public.firms f ON f.id=u.firm_id WHERE u.requested_at>=_from GROUP BY u.firm_id,f.name ORDER BY count(*) DESC;END; $$;
CREATE OR REPLACE FUNCTION public.purge_trixie_usage() RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='public' AS $$ DECLARE n integer;BEGIN PERFORM app_private.assert_aal2();IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'Forbidden';END IF;DELETE FROM public.trixie_usage WHERE requested_at<now()-interval '13 months';GET DIAGNOSTICS n=ROW_COUNT;RETURN n;END; $$;
REVOKE ALL ON FUNCTION public.trixie_access_context(uuid,uuid,boolean),public.reserve_trixie_usage(uuid,uuid,boolean),public.finalise_trixie_usage(uuid,text,text,integer,integer,integer,numeric,text),public.search_trixie_knowledge(text,uuid,uuid,boolean,integer),public.admin_trixie_settings(),public.save_trixie_settings(boolean,text,integer,integer,integer,numeric),public.admin_trixie_knowledge(),public.save_trixie_article(uuid,text,text,text[],text,boolean),public.admin_trixie_limits(),public.save_trixie_org_limit(uuid,integer),public.admin_trixie_usage(timestamptz),public.purge_trixie_usage() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.trixie_access_context(uuid,uuid,boolean),public.reserve_trixie_usage(uuid,uuid,boolean),public.finalise_trixie_usage(uuid,text,text,integer,integer,integer,numeric,text),public.search_trixie_knowledge(text,uuid,uuid,boolean,integer),public.admin_trixie_settings(),public.save_trixie_settings(boolean,text,integer,integer,integer,numeric),public.admin_trixie_knowledge(),public.save_trixie_article(uuid,text,text,text[],text,boolean),public.admin_trixie_limits(),public.save_trixie_org_limit(uuid,integer),public.admin_trixie_usage(timestamptz),public.purge_trixie_usage() TO authenticated,service_role;