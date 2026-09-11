REVOKE INSERT, UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (display_name) ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own display name"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

REVOKE ALL PRIVILEGES ON TABLE public.user_presence FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.user_presence FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_presence TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.user_presence TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_display_name text;
BEGIN
  v_display_name := nullif(btrim(coalesce(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'display_name'
  )), '');

  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, v_display_name);

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'advisor') THEN
    v_role := 'advisor';
  ELSE
    v_role := 'client_viewer';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

CREATE OR REPLACE FUNCTION public.set_profile_display_name_admin(
  _target_user_id uuid,
  _display_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_name text;
  v_old_name text;
BEGIN
  PERFORM app_private.assert_aal2();
  IF NOT app_private.me_is_super_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'insufficient_privilege';
  END IF;

  v_name := btrim(_display_name);
  IF v_name IS NULL OR length(v_name) < 1 OR length(v_name) > 80
     OR v_name ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'INVALID_DISPLAY_NAME' USING errcode = '22023';
  END IF;

  SELECT display_name INTO v_old_name
  FROM public.profiles
  WHERE id = _target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  UPDATE public.profiles
  SET display_name = v_name
  WHERE id = _target_user_id;

  INSERT INTO public.audit_log (
    actor_user_id, action, target_type, target_id, meta
  ) VALUES (
    auth.uid(),
    'profile_name_changed',
    'user',
    _target_user_id::text,
    jsonb_build_object('old_value', v_old_name, 'new_value', v_name)
  );

  RETURN v_name;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_profile_display_name_admin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_profile_display_name_admin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_profile_display_name_admin(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.online_users(_window_minutes integer DEFAULT 5)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  email text,
  is_super_admin boolean,
  has_mfa boolean,
  last_seen_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM app_private.assert_aal2();
  IF NOT app_private.me_is_super_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'insufficient_privilege';
  END IF;
  RETURN QUERY
    SELECT p.user_id,
           pr.display_name,
           u.email::text,
           EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role='super_admin'),
           EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = p.user_id AND f.status='verified'),
           p.last_seen_at
    FROM public.user_presence p
    LEFT JOIN public.profiles pr ON pr.id = p.user_id
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.last_seen_at > now() - make_interval(mins => greatest(1, least(_window_minutes, 60)))
    ORDER BY p.last_seen_at DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.online_users(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.online_users(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.online_users(integer) TO service_role;

DO $migration$
DECLARE
  ddl text;
  old_fragment text := $old$
  select count(*) into n from pg_policies
  where schemaname='public' and tablename='audit_log' and cmd in ('INSERT','UPDATE','DELETE','ALL')
    and 'authenticated' = any(roles);
  select count(*) into n2 from information_schema.role_table_grants
  where table_schema='public' and table_name='audit_log' and grantee='authenticated'
    and privilege_type in ('INSERT','UPDATE','DELETE');
$old$;
  new_fragment text := $new$
  select count(*) into n from pg_policies
  where schemaname='public' and tablename='audit_log'
    and permissive='PERMISSIVE'
    and cmd in ('INSERT','UPDATE','DELETE','ALL')
    and ('authenticated' = any(roles) or 'public' = any(roles));
  select count(*) into n2
  from unnest(array['INSERT','UPDATE','DELETE','TRUNCATE']) privilege
  where has_table_privilege('authenticated', 'public.audit_log', privilege);
$new$;
BEGIN
  SELECT pg_get_functiondef('public.security_posture()'::regprocedure) INTO ddl;
  IF position(old_fragment in ddl) = 0 THEN
    RAISE EXCEPTION 'Expected audit_append_only fragment not found';
  END IF;
  ddl := replace(ddl, old_fragment, new_fragment);
  EXECUTE ddl;
END;
$migration$;