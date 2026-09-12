CREATE OR REPLACE FUNCTION public.record_security_attestation(_check_key text, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  attestable text[] := array['leaked_password'];
  _clean text;
begin
  perform app_private.assert_aal2();
  if not app_private.is_super_admin(auth.uid()) then
    raise exception 'Not authorised.';
  end if;
  if _check_key is null or not (_check_key = any(attestable)) then
    raise exception 'That check cannot be attested.';
  end if;
  if _note is not null and length(_note) > 500 then
    raise exception 'Note is too long.';
  end if;

  _clean := nullif(btrim(coalesce(_note, '')), '');

  -- update-then-insert rather than ON CONFLICT: the identity and the time are
  -- always taken from the server, never from the caller.
  update public.security_attestations
     set confirmed_by = auth.uid(),
         confirmed_at = now(),
         note = _clean
   where check_key = _check_key;

  if not found then
    insert into public.security_attestations (check_key, confirmed_by, confirmed_at, note)
    values (_check_key, auth.uid(), now(), _clean);
  end if;

  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'security_attestation_recorded', 'security_attestation', _check_key,
          jsonb_build_object('check_key', _check_key, 'has_note', _note is not null));
end;
$function$;