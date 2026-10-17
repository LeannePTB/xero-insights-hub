-- Roadmap: linked entries stop showing once their card/module is Available OR retired.
CREATE OR REPLACE FUNCTION app_private.coming_soon_still_coming(_module text, _card text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select case
    when _card is not null then not exists (select 1 from public.card_catalogue where card_key = _card and status in ('available','retired'))
    when _module is not null then
      not exists (select 1 from public.card_catalogue where module_key = _module and status = 'available')
      and not (exists (select 1 from public.card_catalogue where module_key = _module)
               and not exists (select 1 from public.card_catalogue where module_key = _module and status <> 'retired'))
    else true end
$function$;

-- Roadmap order follows the saved sort order (automatic entries after, by name).
CREATE OR REPLACE FUNCTION app_private.coming_soon_rows(_firm_id uuid)
 RETURNS TABLE(entry_key text, name text, description text, timing text, early_access boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select r.entry_key, r.name, r.description, r.timing, r.early_access from (
    select e.entry_key, e.name, e.description, e.timing, e.sort_order as so,
           exists (select 1 from unnest(app_private.firm_early_access_cards(_firm_id)) k
                    join public.card_catalogue c on c.card_key = k
                   where k = e.card_key or (e.module_key is not null and c.module_key = e.module_key)) as early_access
      from public.coming_soon_entries e
     where e.is_shown and app_private.coming_soon_still_coming(e.module_key, e.card_key)
    union all
    select 'auto_' || c.card_key, c.label, c.description, null::text, 1000,
           exists (select 1 from unnest(app_private.firm_early_access_cards(_firm_id)) k where k = c.card_key)
      from public.card_catalogue c
     where c.status = 'wip'
       and not c.hide_from_coming_soon
       and not exists (select 1 from public.coming_soon_entries e where e.card_key = c.card_key)
  ) r
  order by r.so, r.name
$function$;

-- Card status: System Administrators may also retire / restore (audited, aal2).
CREATE OR REPLACE FUNCTION public.admin_set_card_status(_card_key text, _status text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _old text;
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  if _status not in ('available','wip','retired') then raise exception 'INVALID_STATUS' using errcode = 'check_violation'; end if;
  select status into _old from public.card_catalogue where card_key = _card_key for update;
  if not found then raise exception 'NO_SUCH_CARD' using errcode = 'no_data_found'; end if;
  update public.card_catalogue set status = _status, updated_at = now(), updated_by = auth.uid() where card_key = _card_key;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'card_catalogue_status_changed', 'card', _card_key, jsonb_build_object('from', _old, 'to', _status));
end;
$function$;

-- Main contact email (platform metadata, Path C).
ALTER TABLE public.platform_branding ADD COLUMN IF NOT EXISTS main_contact_email text;
UPDATE public.platform_branding SET main_contact_email = 'hello@tractionadvisory.com.au' WHERE id = true AND main_contact_email IS NULL;

CREATE OR REPLACE FUNCTION public.get_platform_contact()
 RETURNS TABLE(main_contact_email text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select b.main_contact_email from public.platform_branding b where b.id = true
$function$;
REVOKE ALL ON FUNCTION public.get_platform_contact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_contact() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_main_contact_email(_email text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _old text; _new text := lower(btrim(_email));
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  if _new is null or _new !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(_new) > 254 then
    raise exception 'INVALID_EMAIL' using errcode = 'check_violation';
  end if;
  select main_contact_email into _old from public.platform_branding where id = true for update;
  update public.platform_branding set main_contact_email = _new, updated_at = now(), updated_by = auth.uid() where id = true;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'platform_main_contact_changed', 'platform_branding', 'platform', jsonb_build_object('changed', _old is distinct from _new));
end;
$function$;
REVOKE ALL ON FUNCTION public.admin_set_main_contact_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_main_contact_email(text) TO authenticated;

-- Alert address suppression: read and unblock ONLY the configured enquiry alert address.
CREATE OR REPLACE FUNCTION public.admin_alert_address_suppression()
 RETURNS TABLE(address text, suppressed boolean, reason text, suppressed_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _addr text;
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  select lower(b.enquiry_alert_email) into _addr from public.platform_branding b where b.id = true;
  if _addr is null then return; end if;
  return query select _addr, s.email is not null, s.reason, s.created_at
    from (select 1) one left join lateral (
      select e.email, e.reason, e.created_at from public.suppressed_emails e
       where lower(e.email) = _addr order by e.created_at desc limit 1) s on true;
end;
$function$;
REVOKE ALL ON FUNCTION public.admin_alert_address_suppression() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_alert_address_suppression() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_unblock_alert_address()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _addr text; _n integer;
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  select lower(b.enquiry_alert_email) into _addr from public.platform_branding b where b.id = true;
  if _addr is null then raise exception 'NO_ALERT_ADDRESS' using errcode = 'no_data_found'; end if;
  delete from public.suppressed_emails where lower(email) = _addr;
  get diagnostics _n = row_count;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'alert_address_unblocked', 'platform_branding', 'enquiry_alert_email', jsonb_build_object('rows_removed', _n));
  return _n;
end;
$function$;
REVOKE ALL ON FUNCTION public.admin_unblock_alert_address() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unblock_alert_address() TO authenticated;