ALTER TABLE public.platform_branding ADD COLUMN IF NOT EXISTS enquiry_alert_email text CHECK (enquiry_alert_email IS NULL OR (length(enquiry_alert_email) BETWEEN 3 AND 254 AND enquiry_alert_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
UPDATE public.platform_branding SET enquiry_alert_email='hello@tractionadvisory.com.au' WHERE id=true AND enquiry_alert_email IS NULL;
ALTER TABLE public.upgrade_enquiries ADD COLUMN IF NOT EXISTS alert_message_id text, ADD COLUMN IF NOT EXISTS alert_error text;

-- System Administrator (AAL2) reads the alert address. Not exposed to anon readers.
CREATE OR REPLACE FUNCTION public.get_enquiry_alert_email() RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM app_private.assert_aal2(); PERFORM public.assert_super_admin();
 RETURN (SELECT enquiry_alert_email FROM public.platform_branding WHERE id=true);
END $$;
REVOKE EXECUTE ON FUNCTION public.get_enquiry_alert_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_enquiry_alert_email() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_enquiry_alert_email(_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM app_private.assert_aal2(); PERFORM public.assert_super_admin();
 _email:=nullif(lower(trim(_email)),'');
 IF _email IS NOT NULL AND (length(_email) NOT BETWEEN 3 AND 254 OR _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 INSERT INTO public.platform_branding(id,enquiry_alert_email,updated_at,updated_by) VALUES(true,_email,now(),auth.uid()) ON CONFLICT(id) DO UPDATE SET enquiry_alert_email=excluded.enquiry_alert_email,updated_at=now(),updated_by=auth.uid();
 INSERT INTO public.audit_log(actor_user_id,action,target_type,target_id,meta) VALUES(auth.uid(),'enquiry_alert_email_saved','platform_branding','platform',jsonb_build_object('set',_email IS NOT NULL));
END $$;
REVOKE EXECUTE ON FUNCTION public.save_enquiry_alert_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_enquiry_alert_email(text) TO authenticated;

-- Audited test-send authorisation; returns the configured address.
CREATE OR REPLACE FUNCTION public.begin_enquiry_alert_test() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE _e text; BEGIN
 PERFORM app_private.assert_aal2(); PERFORM public.assert_super_admin();
 SELECT enquiry_alert_email INTO _e FROM public.platform_branding WHERE id=true;
 IF _e IS NULL THEN RAISE EXCEPTION 'NOT_CONFIGURED'; END IF;
 INSERT INTO public.audit_log(actor_user_id,action,target_type,target_id,meta) VALUES(auth.uid(),'enquiry_alert_test_sent','platform_branding','platform','{}');
 RETURN _e;
END $$;
REVOKE EXECUTE ON FUNCTION public.begin_enquiry_alert_test() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_enquiry_alert_test() TO authenticated;

-- Latest send status per enquiry alert (System Administrator, AAL2).
CREATE OR REPLACE FUNCTION public.admin_upgrade_enquiry_alerts() RETURNS TABLE(enquiry_id uuid, status text, error text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM app_private.assert_aal2(); IF NOT app_private.me_is_super_admin() THEN RAISE EXCEPTION 'NO_ACCESS' USING errcode='42501'; END IF;
 RETURN QUERY SELECT e.id, coalesce(l.status, CASE WHEN e.alert_error IS NOT NULL THEN 'failed' ELSE 'not_sent' END), coalesce(l.error_message, e.alert_error)
 FROM public.upgrade_enquiries e
 LEFT JOIN LATERAL (SELECT s.status, s.error_message FROM public.email_send_log s WHERE s.message_id=e.alert_message_id ORDER BY s.created_at DESC LIMIT 1) l ON true
 ORDER BY e.created_at DESC LIMIT 200;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_upgrade_enquiry_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upgrade_enquiry_alerts() TO authenticated;
NOTIFY pgrst,'reload schema';