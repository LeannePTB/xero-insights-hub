ALTER TABLE public.platform_branding ADD COLUMN website_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE OR REPLACE FUNCTION public.get_public_website_settings() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT jsonb_build_object('calendlyUrl',b.website_settings->>'calendlyUrl','heroVideoPath',b.website_settings->>'heroVideoPath','heroPosterPath',b.website_settings->>'heroPosterPath','walkthroughUrl',b.website_settings->>'walkthroughUrl','standardPrice',b.website_settings->>'standardPrice','advisoryPrice',b.website_settings->>'advisoryPrice','consolidationPrice',b.website_settings->>'consolidationPrice','whiteLabelPrice',b.website_settings->>'whiteLabelPrice') FROM public.platform_branding b WHERE b.id = true $$;
REVOKE ALL ON FUNCTION public.get_public_website_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_website_settings() TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.save_public_website_settings(_settings jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; v text;
BEGIN
 PERFORM app_private.assert_aal2();
 PERFORM public.assert_super_admin();
 IF jsonb_typeof(_settings) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid settings'; END IF;
 FOR k,v IN SELECT key,value FROM jsonb_each_text(_settings) LOOP
  IF k NOT IN ('calendlyUrl','heroVideoPath','heroPosterPath','walkthroughUrl','standardPrice','advisoryPrice','consolidationPrice','whiteLabelPrice') OR length(v)>500 OR (v IS NOT NULL AND jsonb_typeof(_settings->k)<>'string') THEN RAISE EXCEPTION 'Invalid settings'; END IF;
  IF v IS NOT NULL AND v<>'' THEN
   IF k='calendlyUrl' AND v !~ '^https://calendly[.]com/[A-Za-z0-9/_-]+$' THEN RAISE EXCEPTION 'Invalid booking URL'; END IF;
   IF k='walkthroughUrl' AND v !~ '^https://(www[.])?(youtube[.]com/watch[?]v=[A-Za-z0-9_-]{11}|youtu[.]be/[A-Za-z0-9_-]{11}|loom[.]com/share/[a-fA-F0-9]{32})$' THEN RAISE EXCEPTION 'Invalid walkthrough URL'; END IF;
   IF k='heroVideoPath' AND v !~ '^hero/[a-f0-9-]{36}[.]mp4$' THEN RAISE EXCEPTION 'Invalid media path'; END IF;
   IF k='heroPosterPath' AND v !~ '^poster/[a-f0-9-]{36}[.](png|jpg|webp)$' THEN RAISE EXCEPTION 'Invalid media path'; END IF;
   IF k LIKE '%Price' AND length(v)>80 THEN RAISE EXCEPTION 'Invalid price label'; END IF;
  END IF;
 END LOOP;
 INSERT INTO public.platform_branding(id,website_settings,updated_at,updated_by) VALUES(true,_settings,now(),auth.uid()) ON CONFLICT(id) DO UPDATE SET website_settings=excluded.website_settings,updated_at=now(),updated_by=auth.uid();
 INSERT INTO public.audit_log(actor_user_id,action,target_type,target_id,meta) VALUES(auth.uid(),'public_website_settings_saved','platform_branding','platform',jsonb_build_object('fields',ARRAY(SELECT jsonb_object_keys(_settings))));
END $$;
REVOKE ALL ON FUNCTION public.save_public_website_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_public_website_settings(jsonb) TO authenticated, service_role;
CREATE POLICY website_media_admin_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='website-media' AND app_private.is_aal2() AND app_private.me_is_super_admin() AND ((name ~ '^hero/[a-f0-9-]{36}[.]mp4$' AND metadata->>'mimetype'='video/mp4' AND (metadata->>'size')::bigint<=26214400) OR (name ~ '^poster/[a-f0-9-]{36}[.](png|jpg|webp)$' AND metadata->>'mimetype' IN ('image/png','image/jpeg','image/webp') AND (metadata->>'size')::bigint<=2097152)));
NOTIFY pgrst, 'reload schema';