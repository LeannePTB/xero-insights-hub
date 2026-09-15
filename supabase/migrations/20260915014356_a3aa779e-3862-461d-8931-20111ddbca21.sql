-- 1. record_sign_out_all_devices: state the aal2 guard on its own first line.
CREATE OR REPLACE FUNCTION public.record_sign_out_all_devices(_user_id uuid, _method text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Stated explicitly as the first statement (harmless duplication of the
  -- assertion inside admin_assert_can_sign_out_user) so the posture check can
  -- see the guard rather than infer it from the call below.
  perform app_private.assert_aal2();
  perform public.admin_assert_can_sign_out_user(_user_id);
  if _method not in ('credential_reset') then
    raise exception 'Unknown revocation method';
  end if;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'sessions_revoked_all', 'user', _user_id::text,
          jsonb_build_object('at', now(), 'method', _method));
end;
$function$;

-- 2. Two documented exclusions in security_posture, with the reason inline in
--    the evidence text. Nothing else about the checks changes.
DO $mig$
DECLARE def text; before_a text; before_b text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'security_posture';

  before_a := def;
  def := replace(def,
    $q$      and c.relname not in ('plan_levels','tier_settings')$q$,
    $q$      and c.relname not in ('plan_levels','tier_settings','session_activity')$q$);
  IF def = before_a THEN RAISE EXCEPTION 'aal2_tables exclusion anchor not found'; END IF;

  before_a := def;
  def := replace(def,
    $q$      then (select count(*)::text || ' tables with mfa_aal2_required'$q$,
    $q$      then (select count(*)::text || ' tables with mfa_aal2_required. Documented exclusion: session_activity, because app_private.is_aal2() itself reads that table to decide whether a session is idle, so a restrictive aal2 policy on it would be circular. It carries RLS, grants nothing to anon, is readable only on the row of the session that owns it, and is written solely by public.touch_session_activity().'$q$);
  IF def = before_a THEN RAISE EXCEPTION 'aal2_tables evidence anchor not found'; END IF;

  before_b := def;
  def := replace(def,
    $q$      and p.proname <> 'xero_required_scopes'$q$,
    $q$      and p.proname not in ('xero_required_scopes','session_is_active')$q$);
  IF def = before_b THEN RAISE EXCEPTION 'definer_guards exclusion anchor not found'; END IF;

  before_b := def;
  def := replace(def,
    $q$ function(s) scanned; xero_required_scopes excluded (constant list).'$q$,
    $q$ function(s) scanned. Two documented exclusions: xero_required_scopes (a constant list, no data access), and session_is_active (the aal2 guard itself calls it to decide whether a session is idle, so asserting aal2 inside it would be circular; it returns one boolean about the calling session and no data).'$q$);
  IF def = before_b THEN RAISE EXCEPTION 'definer_guards evidence anchor not found'; END IF;

  EXECUTE def;
END
$mig$;