CREATE TABLE public.client_report_pending_videos (
 client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 period_end date NOT NULL,
 video_url text, video_heading text, video_message text,
 video_set_by uuid, video_set_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(client_id, period_end),
 CHECK (video_url IS NULL OR (length(video_url) <= 500 AND video_url ~ '^https?://([A-Za-z0-9-]+\.)*loom\.com/(share|embed)/[A-Za-z0-9]{16,64}/?(\?[^#]*)?(#.*)?$')),
 CHECK (length(video_heading) <= 120), CHECK(length(video_message) <= 600)
);
REVOKE ALL ON public.client_report_pending_videos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.client_report_pending_videos TO authenticated;
GRANT ALL ON public.client_report_pending_videos TO service_role;
ALTER TABLE public.client_report_pending_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY pending_video_manager_read ON public.client_report_pending_videos FOR SELECT TO authenticated USING (app_private.user_can_write_client(auth.uid(),client_id));
CREATE POLICY mfa_aal2_required ON public.client_report_pending_videos AS RESTRICTIVE FOR ALL TO authenticated USING (app_private.is_aal2()) WITH CHECK (app_private.is_aal2());
CREATE OR REPLACE FUNCTION public.get_pending_report_video(_client_id uuid,_period_end date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
 PERFORM app_private.assert_aal2();
 IF auth.uid() IS NULL OR NOT public.me_can_manage_client(_client_id) THEN RAISE EXCEPTION 'Report not available.' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('video_url',p.video_url,'video_heading',p.video_heading,'video_message',p.video_message) INTO v FROM public.client_report_pending_videos p WHERE p.client_id=_client_id AND p.period_end=_period_end;
 IF v IS NULL THEN SELECT jsonb_build_object('video_url',r.video_url,'video_heading',r.video_heading,'video_message',r.video_message) INTO v FROM public.client_reports r WHERE r.client_id=_client_id AND r.period_end=_period_end AND r.report_key='monthly_management' ORDER BY r.version DESC LIMIT 1; END IF;
 RETURN coalesce(v,'{}'::jsonb);
END $$;
REVOKE EXECUTE ON FUNCTION public.get_pending_report_video(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_pending_report_video(uuid,date) TO authenticated;
CREATE OR REPLACE FUNCTION public.save_report_video(_client_id uuid,_period_end date,_report_id uuid DEFAULT NULL,_url text DEFAULT NULL,_heading text DEFAULT NULL,_message text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.client_reports%rowtype; f uuid; u text:=nullif(btrim(_url),''); h text:=nullif(btrim(_heading),''); m text:=nullif(btrim(_message),'');
BEGIN
 PERFORM app_private.assert_aal2();
 IF auth.uid() IS NULL OR NOT public.me_can_manage_client(_client_id) THEN RAISE EXCEPTION 'Report not available.' USING ERRCODE='42501'; END IF;
 IF _period_end IS NULL OR length(u)>500 OR length(h)>120 OR length(m)>600 OR (u IS NOT NULL AND u !~ '^https?://([A-Za-z0-9-]+\.)*loom\.com/(share|embed)/[A-Za-z0-9]{16,64}/?(\?[^#]*)?(#.*)?$') THEN RAISE EXCEPTION 'Invalid report video.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_client_id::text||_period_end::text,0));
 SELECT firm_id INTO f FROM public.clients WHERE id=_client_id;
 IF _report_id IS NOT NULL THEN
  SELECT * INTO r FROM public.client_reports WHERE id=_report_id AND client_id=_client_id AND period_end=_period_end FOR UPDATE;
  IF r.id IS NULL OR r.status <> 'draft' THEN RAISE EXCEPTION 'This report video is locked.' USING ERRCODE='42501'; END IF;
 END IF;
 IF u IS NULL THEN h:=NULL; m:=NULL; END IF;
 INSERT INTO public.client_report_pending_videos(client_id,period_end,video_url,video_heading,video_message,video_set_by,video_set_at) VALUES (_client_id,_period_end,u,h,m,auth.uid(),now()) ON CONFLICT(client_id,period_end) DO UPDATE SET video_url=excluded.video_url,video_heading=excluded.video_heading,video_message=excluded.video_message,video_set_by=excluded.video_set_by,video_set_at=excluded.video_set_at;
 IF _report_id IS NOT NULL THEN UPDATE public.client_reports SET video_url=u,video_heading=h,video_message=m,video_set_by=CASE WHEN u IS NULL THEN NULL ELSE auth.uid() END,video_set_at=CASE WHEN u IS NULL THEN NULL ELSE now() END WHERE id=r.id AND status='draft'; END IF;
 INSERT INTO public.audit_log(id,actor_user_id,firm_id,action,target_type,target_id,meta) VALUES(gen_random_uuid(),auth.uid(),f,CASE WHEN u IS NULL THEN 'client_report_video_cleared' ELSE 'client_report_video_set' END,'client',_client_id,jsonb_build_object('period_end',_period_end,'report_id',_report_id));
END $$;
REVOKE EXECUTE ON FUNCTION public.save_report_video(uuid,date,uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_report_video(uuid,date,uuid,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.attach_pending_report_video() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.client_report_pending_videos%rowtype;
BEGIN
 IF TG_OP='UPDATE' AND OLD.status IN ('final','sent') AND (NEW.status='draft' OR ROW(NEW.video_url,NEW.video_heading,NEW.video_message,NEW.video_set_by,NEW.video_set_at) IS DISTINCT FROM ROW(OLD.video_url,OLD.video_heading,OLD.video_message,OLD.video_set_by,OLD.video_set_at)) THEN RAISE EXCEPTION 'This report video is locked.'; END IF;
 IF NEW.status='draft' AND (TG_OP='INSERT' OR NEW.generated_at IS DISTINCT FROM OLD.generated_at) THEN
  SELECT * INTO p FROM public.client_report_pending_videos WHERE client_id=NEW.client_id AND period_end=NEW.period_end;
  IF FOUND THEN NEW.video_url:=p.video_url; NEW.video_heading:=p.video_heading; NEW.video_message:=p.video_message; NEW.video_set_by:=CASE WHEN p.video_url IS NULL THEN NULL ELSE p.video_set_by END; NEW.video_set_at:=CASE WHEN p.video_url IS NULL THEN NULL ELSE p.video_set_at END; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.attach_pending_report_video() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER attach_pending_report_video BEFORE INSERT OR UPDATE ON public.client_reports FOR EACH ROW EXECUTE FUNCTION public.attach_pending_report_video();