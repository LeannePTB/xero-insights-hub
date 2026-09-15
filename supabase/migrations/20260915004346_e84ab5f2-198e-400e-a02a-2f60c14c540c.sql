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

  -- Primary key lookup on a revoked-session-aware table.
  select s.created_at into _signed_in_at
  from auth.sessions s
  where s.id = _session_id;

  if _signed_in_at is null then
    return false; -- revoked or unknown session: fail closed
  end if;

  -- Primary key lookup. Sign-in itself counts as activity until the first
  -- recorded interaction; after that the server-held timestamp is the control.
  select a.last_activity_at into _last
  from public.session_activity a
  where a.session_id = _session_id;

  return coalesce(_last, _signed_in_at) > now() - _window;
end;
$function$;