CREATE OR REPLACE FUNCTION public.admin_set_card_label(_card_key text, _label text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare _old text; _new text := btrim(coalesce(_label, ''));
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  if char_length(_new) < 1 or char_length(_new) > 60 then
    raise exception 'INVALID_LABEL' using errcode = 'check_violation';
  end if;
  select label into _old from public.card_catalogue where card_key = _card_key for update;
  if not found then raise exception 'NO_SUCH_CARD' using errcode = 'no_data_found'; end if;
  if _old is not distinct from _new then return; end if;
  update public.card_catalogue set label = _new, updated_at = now(), updated_by = auth.uid() where card_key = _card_key;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'card_catalogue_label_changed', 'card', _card_key, jsonb_build_object('from', _old, 'to', _new));
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_set_card_label(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_card_label(text, text) TO authenticated;