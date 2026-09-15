-- 1. Server-held activity timestamp -----------------------------------------
CREATE TABLE public.session_activity (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.session_activity FROM anon, authenticated;
GRANT SELECT ON public.session_activity TO authenticated;
GRANT ALL ON public.session_activity TO service_role;

ALTER TABLE public.session_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_activity_select_own"
  ON public.session_activity FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX session_activity_user_id_idx ON public.session_activity (user_id);

-- 2. Enforcement helper ------------------------------------------------------
CREATE OR REPLACE FUNCTION app_private.is_session_active()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  _window constant interval := interval '30 minutes';
  _claims jsonb;
  _session_id uuid;
  _signed_in_at timestamptz;
  _last timestamptz;
begin
  _claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;

  -- No request context (cron, migrations, maintenance) or service role
  -- (webhooks, OAuth callback, email queue): system contexts, not a person.
  if _claims is null or coalesce(_claims ->> 'role', '') = 'service_role' then
    return true;
  end if;

  _session_id := nullif(_claims ->> 'session_id', '')::uuid;
  if _session_id is null then
    return false; -- unverifiable: fail closed
  end if;

  select s.created_at into _signed_in_at
  from auth.sessions s
  where s.id = _session_id;

  if _signed_in_at is null then
    return false; -- revoked or unknown session: fail closed
  end if;

  select a.last_activity_at into _last
  from public.session_activity a
  where a.session_id = _session_id;

  return greatest(_signed_in_at, coalesce(_last, _signed_in_at)) > now() - _window;
end;
$function$;

REVOKE EXECUTE ON FUNCTION app_private.is_session_active() FROM PUBLIC, anon;

-- 3. Recording activity (server-set values only) -----------------------------
CREATE OR REPLACE FUNCTION public.touch_session_activity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  _claims jsonb;
  _session_id uuid;
begin
  perform app_private.assert_aal2();

  _claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  _session_id := nullif(_claims ->> 'session_id', '')::uuid;
  if _session_id is null or auth.uid() is null then
    raise exception 'SESSION_IDLE' using errcode = 'insufficient_privilege';
  end if;

  -- Caller-scoped: the session and the person come from the verified token, and
  -- the time comes from the server. Nothing here is caller supplied.
  update public.session_activity
     set last_activity_at = now()
   where session_id = _session_id
     and user_id = auth.uid();

  if not found then
    insert into public.session_activity (session_id, user_id, last_activity_at)
    values (_session_id, auth.uid(), now())
    on conflict (session_id) do update
      set last_activity_at = now()
      where public.session_activity.user_id = auth.uid();
  end if;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.touch_session_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_session_activity() TO authenticated;

-- 4. Wire the idle check into the single aal2 implementation ------------------
CREATE OR REPLACE FUNCTION app_private.is_aal2()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  select case
    -- No HTTP request context: cron, migrations, direct maintenance. These are
    -- system contexts, not a signed-in person.
    when nullif(current_setting('request.jwt.claims', true), '') is null then true
    -- Service role (webhooks, OAuth callback, email queue, nightly refresh)
    -- already bypasses row level security, so MFA is not the control there.
    when coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
           ''
         ) = 'service_role' then true
    else coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal',
           ''
         ) = 'aal2'
         and app_private.is_session_fresh()
         and app_private.is_session_active()
  end
$function$;

CREATE OR REPLACE FUNCTION app_private.assert_aal2()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO ''
AS $function$
begin
  if not app_private.is_session_fresh() then
    raise exception 'SESSION_EXPIRED' using errcode = 'insufficient_privilege';
  end if;

  -- Idle is not an MFA problem: a distinct code so the person is asked to sign
  -- in again, never sent to their authenticator app.
  if not app_private.is_session_active() then
    raise exception 'SESSION_IDLE' using errcode = 'insufficient_privilege';
  end if;

  if not app_private.is_aal2() then
    raise exception 'MFA_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  return true;
end;
$function$;

-- 5. Remote sign-out (authorise + audit; revocation is the Auth admin API) ---
CREATE OR REPLACE FUNCTION public.admin_sign_out_all_devices(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  perform app_private.assert_aal2();

  if not app_private.is_super_admin(auth.uid()) then
    raise exception 'Not authorised.';
  end if;

  if _user_id is null then
    raise exception 'A person must be named.';
  end if;

  -- Signing yourself out of everything is a self-service action, not an
  -- administrative one over another person.
  if _user_id = auth.uid() then
    raise exception 'Use sign out my other devices for your own account.';
  end if;

  if not exists (select 1 from auth.users u where u.id = _user_id) then
    raise exception 'That person does not exist.';
  end if;

  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'sessions_revoked_all', 'user', _user_id::text,
          jsonb_build_object('subject_user_id', _user_id, 'at', now()));
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_sign_out_all_devices(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_sign_out_all_devices(uuid) TO authenticated;

-- 6. Audit trail for signing out your own other devices ----------------------
CREATE OR REPLACE FUNCTION public.record_sign_out_other_devices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  perform app_private.assert_aal2();
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'sessions_revoked_others', 'user', auth.uid()::text,
          jsonb_build_object('at', now()));
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_sign_out_other_devices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sign_out_other_devices() TO authenticated;