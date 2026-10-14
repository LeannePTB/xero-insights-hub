CREATE TABLE public.upgrade_enquiries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submitter_id uuid NOT NULL, firm_id uuid NOT NULL REFERENCES public.firms(id), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100), email text NOT NULL CHECK(length(email) BETWEEN 3 AND 255), organisation_name text NOT NULL, module_keys text[] NOT NULL DEFAULT '{}', client_ids uuid[] NOT NULL DEFAULT '{}', message text NOT NULL CHECK(length(message) BETWEEN 1 AND 2000), status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','done')), submission_key uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(submitter_id,submission_key));
REVOKE ALL ON public.upgrade_enquiries FROM anon, authenticated;
GRANT SELECT ON public.upgrade_enquiries TO authenticated;
GRANT ALL ON public.upgrade_enquiries TO service_role;
ALTER TABLE public.upgrade_enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY mfa_aal2_required ON public.upgrade_enquiries AS RESTRICTIVE FOR ALL TO authenticated USING(app_private.is_aal2()) WITH CHECK(app_private.is_aal2());
CREATE POLICY enquiry_submitter_read ON public.upgrade_enquiries FOR SELECT TO authenticated USING(submitter_id=auth.uid() AND public.me_can_manage_cards(firm_id));
CREATE POLICY enquiry_admin_read ON public.upgrade_enquiries FOR SELECT TO authenticated USING(app_private.me_is_super_admin());
CREATE INDEX upgrade_enquiries_created ON public.upgrade_enquiries(created_at DESC);
CREATE OR REPLACE FUNCTION public.upgrade_enquiry_context(_firm_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _org text; _email text; _clients jsonb; BEGIN
 PERFORM app_private.assert_aal2();
 IF NOT public.me_can_manage_cards(_firm_id) THEN RETURN NULL; END IF;
 SELECT name INTO _org FROM public.firms WHERE id=_firm_id;
 IF _org IS NULL THEN RETURN NULL; END IF;
 SELECT email INTO _email FROM auth.users WHERE id=auth.uid();
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY name),'[]'::jsonb) INTO _clients FROM public.clients WHERE firm_id=_firm_id AND app_private.user_can_read_client(auth.uid(),id);
 RETURN jsonb_build_object('firmId',_firm_id,'organisation',_org,'email',_email,'clients',_clients,'advisory',coalesce((SELECT advisory_enabled OR (trial_advisory_enabled AND trial_ends_at>now()) FROM public.org_subscription_options WHERE firm_id=_firm_id),false));
END; $$;
REVOKE EXECUTE ON FUNCTION public.upgrade_enquiry_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.upgrade_enquiry_context(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.submit_upgrade_enquiry(_firm_id uuid,_name text,_module_keys text[],_client_ids uuid[],_message text,_submission_key uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id uuid; _ctx jsonb; BEGIN
 PERFORM app_private.assert_aal2();
 _ctx:=public.upgrade_enquiry_context(_firm_id);
 IF _ctx IS NULL THEN RAISE EXCEPTION 'NO_ACCESS' USING errcode='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('upgrade_enquiry:'||auth.uid()::text,0));
 SELECT id INTO _id FROM public.upgrade_enquiries WHERE submitter_id=auth.uid() AND submission_key=_submission_key;
 IF _id IS NOT NULL THEN RETURN _id; END IF;
 IF _name IS NULL OR length(trim(_name)) NOT BETWEEN 1 AND 100 OR _message IS NULL OR length(trim(_message)) NOT BETWEEN 1 AND 2000 OR _submission_key IS NULL OR _module_keys IS NULL OR _client_ids IS NULL OR cardinality(_module_keys)>20 OR cardinality(_client_ids)>100 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(_module_keys) m WHERE NOT EXISTS(SELECT 1 FROM public.card_modules cm JOIN public.card_catalogue cc ON cc.module_key=cm.module_key WHERE cm.module_key=m AND cc.package='advisory')) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(_client_ids) c WHERE NOT EXISTS(SELECT 1 FROM public.clients WHERE id=c AND firm_id=_firm_id AND app_private.user_can_read_client(auth.uid(),id))) THEN RAISE EXCEPTION 'NO_ACCESS' USING errcode='42501'; END IF;
 IF (SELECT count(*) FROM public.upgrade_enquiries WHERE submitter_id=auth.uid() AND created_at>now()-interval '1 hour')>=3 THEN RAISE EXCEPTION 'ENQUIRY_LIMIT'; END IF;
 INSERT INTO public.upgrade_enquiries(submitter_id,firm_id,name,email,organisation_name,module_keys,client_ids,message,submission_key) VALUES(auth.uid(),_firm_id,trim(_name),_ctx->>'email',_ctx->>'organisation',_module_keys,_client_ids,trim(_message),_submission_key) RETURNING id INTO _id;
 INSERT INTO public.audit_log(actor_user_id,firm_id,action,target_type,target_id,meta) VALUES(auth.uid(),_firm_id,'upgrade_enquiry_submitted','upgrade_enquiry',_id,'{}');
 RETURN _id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.submit_upgrade_enquiry(uuid,text,text[],uuid[],text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_upgrade_enquiry(uuid,text,text[],uuid[],text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_upgrade_enquiries() RETURNS SETOF public.upgrade_enquiries LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM app_private.assert_aal2(); IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'NO_ACCESS' USING errcode='42501'; END IF;
 RETURN QUERY SELECT * FROM public.upgrade_enquiries ORDER BY created_at DESC LIMIT 200;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_upgrade_enquiries() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_upgrade_enquiries() TO authenticated;
CREATE OR REPLACE FUNCTION public.set_upgrade_enquiry_status(_id uuid,_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM app_private.assert_aal2(); IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'NO_ACCESS' USING errcode='42501'; END IF;
 IF _status NOT IN ('new','contacted','done') OR _status IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 UPDATE public.upgrade_enquiries SET status=_status,updated_at=now() WHERE id=_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 INSERT INTO public.audit_log(actor_user_id,action,target_type,target_id,meta) VALUES(auth.uid(),'upgrade_enquiry_status_changed','upgrade_enquiry',_id,jsonb_build_object('status',_status));
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_upgrade_enquiry_status(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_upgrade_enquiry_status(uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';