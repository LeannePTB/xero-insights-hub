-- Part 2: notes are practice-only; Business Owners/Viewers read them only inside a stored report.
DROP POLICY IF EXISTS "Client viewers read notes" ON public.client_notes;

-- Retired catalogue status (kept for the record, never offered or shown).
ALTER TABLE public.card_catalogue DROP CONSTRAINT card_catalogue_status_check;
ALTER TABLE public.card_catalogue ADD CONSTRAINT card_catalogue_status_check CHECK (status = ANY (ARRAY['available','wip','retired']));

CREATE OR REPLACE FUNCTION app_private.card_group_cards(_group text, _include_wip boolean)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select coalesce(array(
    select c.card_key from public.card_catalogue c
     where c.package = _group and (c.status = 'available' or (_include_wip and c.status = 'wip'))
     order by c.sort_order, c.card_key
  ), '{}'::text[])
$$;

-- Part 1: Coming soon entries.
ALTER TABLE public.upgrade_enquiries ADD COLUMN kind text NOT NULL DEFAULT 'enquiry';
ALTER TABLE public.upgrade_enquiries ADD COLUMN entry_key text;
ALTER TABLE public.upgrade_enquiries ADD CONSTRAINT upgrade_enquiries_kind_check CHECK (kind = ANY (ARRAY['enquiry','interest']));

CREATE TABLE public.coming_soon_entries (
  entry_key text PRIMARY KEY CHECK (entry_key ~ '^[a-z][a-z0-9_]{1,39}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 200),
  timing text CHECK (timing IS NULL OR char_length(timing) <= 40),
  sort_order integer NOT NULL DEFAULT 100,
  is_shown boolean NOT NULL DEFAULT true,
  show_on_website boolean NOT NULL DEFAULT false,
  module_key text REFERENCES public.card_modules(module_key) ON UPDATE CASCADE ON DELETE SET NULL,
  card_key text REFERENCES public.card_catalogue(card_key) ON UPDATE CASCADE ON DELETE SET NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.coming_soon_entries FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.coming_soon_entries TO service_role;
ALTER TABLE public.coming_soon_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY mfa_aal2_required ON public.coming_soon_entries AS RESTRICTIVE FOR ALL TO authenticated
  USING (app_private.is_aal2()) WITH CHECK (app_private.is_aal2());

INSERT INTO public.coming_soon_entries (entry_key, name, description, sort_order, is_shown, module_key)
VALUES ('rental_properties', 'Rental properties', 'Rent received per property from Xero', 10, true, 'rental_properties');

-- An entry is still "coming" while its linked card/module has no Available card.
CREATE OR REPLACE FUNCTION app_private.coming_soon_still_coming(_module text, _card text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select case
    when _card is not null then not exists (select 1 from public.card_catalogue where card_key = _card and status = 'available')
    when _module is not null then not exists (select 1 from public.card_catalogue where module_key = _module and status = 'available')
    else true end
$$;
REVOKE EXECUTE ON FUNCTION app_private.coming_soon_still_coming(text, text) FROM PUBLIC, anon, authenticated;

-- Practice users of an organisation: active member, or System Administrator.
CREATE OR REPLACE FUNCTION app_private.me_is_practice_for_firm(_firm_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select auth.uid() is not null and _firm_id is not null and (
    app_private.me_is_super_admin()
    or exists (select 1 from public.firm_members m where m.firm_id = _firm_id and m.user_id = auth.uid() and m.status = 'active'))
$$;
REVOKE EXECUTE ON FUNCTION app_private.me_is_practice_for_firm(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.coming_soon_rows(_firm_id uuid)
RETURNS TABLE(entry_key text, name text, description text, timing text, early_access boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select e.entry_key, e.name, e.description, e.timing,
         exists (select 1 from unnest(app_private.firm_early_access_cards(_firm_id)) k
                  join public.card_catalogue c on c.card_key = k
                 where k = e.card_key or (e.module_key is not null and c.module_key = e.module_key))
    from public.coming_soon_entries e
   where e.is_shown and app_private.coming_soon_still_coming(e.module_key, e.card_key)
   order by e.sort_order, e.name
$$;
REVOKE EXECUTE ON FUNCTION app_private.coming_soon_rows(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.coming_soon_for_client(_client_id uuid)
RETURNS TABLE(entry_key text, name text, description text, timing text, early_access boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
declare _firm uuid;
begin
  perform app_private.assert_aal2();
  select c.firm_id into _firm from public.clients c where c.id = _client_id;
  if _firm is null or not app_private.user_can_read_client(auth.uid(), _client_id)
     or not app_private.me_is_practice_for_firm(_firm) then return; end if;
  return query select * from app_private.coming_soon_rows(_firm);
end; $$;
REVOKE EXECUTE ON FUNCTION public.coming_soon_for_client(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coming_soon_for_client(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.coming_soon_for_firm(_firm_id uuid)
RETURNS TABLE(entry_key text, name text, description text, timing text, early_access boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  perform app_private.assert_aal2();
  if not app_private.me_is_practice_for_firm(_firm_id) then return; end if;
  return query select * from app_private.coming_soon_rows(_firm_id);
end; $$;
REVOKE EXECUTE ON FUNCTION public.coming_soon_for_firm(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coming_soon_for_firm(uuid) TO authenticated;

-- Public website: display fields only, website-ticked entries only.
CREATE OR REPLACE FUNCTION public.public_coming_soon()
RETURNS TABLE(name text, description text, timing text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select e.name, e.description, e.timing from public.coming_soon_entries e
   where e.show_on_website and app_private.coming_soon_still_coming(e.module_key, e.card_key)
   order by e.sort_order, e.name limit 20
$$;
REVOKE EXECUTE ON FUNCTION public.public_coming_soon() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_coming_soon() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_coming_soon_list()
RETURNS TABLE(entry_key text, name text, description text, timing text, sort_order integer, is_shown boolean, show_on_website boolean, module_key text, card_key text, now_available boolean, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  return query select e.entry_key, e.name, e.description, e.timing, e.sort_order, e.is_shown, e.show_on_website,
    e.module_key, e.card_key, (e.module_key is not null or e.card_key is not null) and not app_private.coming_soon_still_coming(e.module_key, e.card_key), e.updated_at
    from public.coming_soon_entries e order by e.sort_order, e.name;
end; $$;
REVOKE EXECUTE ON FUNCTION public.admin_coming_soon_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_coming_soon_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_coming_soon(_entry_key text, _name text, _description text, _timing text, _sort_order integer, _is_shown boolean, _show_on_website boolean, _module_key text, _card_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  insert into public.coming_soon_entries (entry_key, name, description, timing, sort_order, is_shown, show_on_website, module_key, card_key, updated_by, updated_at)
  values (_entry_key, trim(_name), coalesce(trim(_description), ''), nullif(trim(coalesce(_timing, '')), ''), coalesce(_sort_order, 100),
          coalesce(_is_shown, true), coalesce(_show_on_website, false), nullif(_module_key, ''), nullif(_card_key, ''), auth.uid(), now())
  on conflict (entry_key) do update set name = excluded.name, description = excluded.description, timing = excluded.timing,
    sort_order = excluded.sort_order, is_shown = excluded.is_shown, show_on_website = excluded.show_on_website,
    module_key = excluded.module_key, card_key = excluded.card_key, updated_by = auth.uid(), updated_at = now();
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'coming_soon_saved', 'coming_soon', _entry_key,
          jsonb_build_object('shown', coalesce(_is_shown, true), 'website', coalesce(_show_on_website, false), 'module', _module_key, 'card', _card_key));
end; $$;
REVOKE EXECUTE ON FUNCTION public.admin_save_coming_soon(text, text, text, text, integer, boolean, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_coming_soon(text, text, text, text, integer, boolean, boolean, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_coming_soon(_entry_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  delete from public.coming_soon_entries where entry_key = _entry_key;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'coming_soon_deleted', 'coming_soon', _entry_key, '{}');
end; $$;
REVOKE EXECUTE ON FUNCTION public.admin_delete_coming_soon(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_coming_soon(text) TO authenticated;

-- Interest: practice users, shared 3/hour enquiry limit, audited. Returns alert fields.
CREATE OR REPLACE FUNCTION public.register_coming_soon_interest(_client_id uuid, _entry_key text, _submission_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare _firm uuid; _org text; _client text; _email text; _who text; _entry record; _id uuid; _created timestamptz;
begin
  perform app_private.assert_aal2();
  select c.firm_id, c.name into _firm, _client from public.clients c where c.id = _client_id;
  if _firm is null or not app_private.user_can_read_client(auth.uid(), _client_id)
     or not app_private.me_is_practice_for_firm(_firm) then
    raise exception 'NO_ACCESS' using errcode = '42501';
  end if;
  select * into _entry from public.coming_soon_entries e
   where e.entry_key = _entry_key and e.is_shown and app_private.coming_soon_still_coming(e.module_key, e.card_key);
  if not found or _submission_key is null then raise exception 'INVALID_INPUT'; end if;
  select email into _email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if _email is null then raise exception 'NO_ACCESS' using errcode = '42501'; end if;
  select coalesce(nullif(trim(p.display_name), ''), _email) into _who from public.profiles p where p.id = auth.uid();
  _who := left(coalesce(_who, _email), 100);
  select name into _org from public.firms where id = _firm;
  perform pg_advisory_xact_lock(hashtextextended('upgrade_enquiry:'||auth.uid()::text, 0));
  select id, created_at into _id, _created from public.upgrade_enquiries where submitter_id = auth.uid() and submission_key = _submission_key;
  if _id is null then
    if (select count(*) from public.upgrade_enquiries where submitter_id = auth.uid() and created_at > now() - interval '1 hour') >= 3 then
      raise exception 'ENQUIRY_LIMIT';
    end if;
    insert into public.upgrade_enquiries (submitter_id, firm_id, name, email, organisation_name, module_keys, client_ids, message, submission_key, kind, entry_key)
    values (auth.uid(), _firm, _who, _email, _org,
            case when _entry.module_key is not null then array[_entry.module_key] else '{}'::text[] end,
            array[_client_id], 'Interested in: ' || _entry.name, _submission_key, 'interest', _entry_key)
    returning id, created_at into _id, _created;
    insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
    values (auth.uid(), _firm, 'coming_soon_interest', 'upgrade_enquiry', _id, jsonb_build_object('entry', _entry_key));
  end if;
  return jsonb_build_object('id', _id, 'name', _who, 'email', _email, 'organisation', _org, 'client', _client,
                            'entry', _entry.name, 'createdAt', _created);
end; $$;
REVOKE EXECUTE ON FUNCTION public.register_coming_soon_interest(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_coming_soon_interest(uuid, text, uuid) TO authenticated;