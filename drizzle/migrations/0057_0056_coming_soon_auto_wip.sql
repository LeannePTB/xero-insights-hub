-- Coming soon: automatic teasers for every Work-in-progress card, with a
-- per-card opt-out. Showing a teaser still never makes a card visible or
-- usable — that remains client_cards_v2 (Available / Early access).

ALTER TABLE public.card_catalogue
  ADD COLUMN hide_from_coming_soon boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.card_catalogue.hide_from_coming_soon IS
  'Coming soon opt-out: when true this Work-in-progress card is left out of the automatic teasers. Manual coming_soon_entries are unaffected.';

-- Teaser list: curated manual entries first (as before), then an automatic
-- teaser for every Work-in-progress card without the opt-out and without a
-- shown manual entry of its own (no duplicate wording).
CREATE OR REPLACE FUNCTION app_private.coming_soon_rows(_firm_id uuid)
RETURNS TABLE(entry_key text, name text, description text, timing text, early_access boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select * from (
    select e.entry_key, e.name, e.description, e.timing,
           exists (select 1 from unnest(app_private.firm_early_access_cards(_firm_id)) k
                    join public.card_catalogue c on c.card_key = k
                   where k = e.card_key or (e.module_key is not null and c.module_key = e.module_key))
      from public.coming_soon_entries e
     where e.is_shown and app_private.coming_soon_still_coming(e.module_key, e.card_key)
    union all
    select 'auto_' || c.card_key, c.label, c.description, null::text,
           exists (select 1 from unnest(app_private.firm_early_access_cards(_firm_id)) k where k = c.card_key)
      from public.card_catalogue c
     where c.status = 'wip'
       and not c.hide_from_coming_soon
       and not exists (select 1 from public.coming_soon_entries e
                        where e.is_shown and e.card_key = c.card_key)
  ) r
  order by r.entry_key like 'auto_%', r.name
$$;
REVOKE EXECUTE ON FUNCTION app_private.coming_soon_rows(uuid) FROM PUBLIC, anon, authenticated;

-- Interest may also be recorded on an automatic teaser (key auto_<card_key>);
-- the card must still be Work in progress and not opted out. Same gate, same
-- 3-per-hour limit, same audit write as manual entries.
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
  if left(_entry_key, 5) = 'auto_' then
    select c.module_key, c.card_key, c.label into _entry
      from public.card_catalogue c
     where 'auto_' || c.card_key = _entry_key
       and c.status = 'wip' and not c.hide_from_coming_soon;
  else
    select * into _entry from public.coming_soon_entries e
     where e.entry_key = _entry_key and e.is_shown and app_private.coming_soon_still_coming(e.module_key, e.card_key);
  end if;
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

-- System Administrator opt-out tick for the automatic teaser. Same guard
-- pattern as admin_set_card_status: aal2, super admin, audited.
CREATE OR REPLACE FUNCTION public.admin_set_card_coming_soon(_card_key text, _hidden boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare _old boolean;
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  if _hidden is null then raise exception 'INVALID_INPUT' using errcode = 'check_violation'; end if;
  select hide_from_coming_soon into _old from public.card_catalogue where card_key = _card_key for update;
  if not found then raise exception 'NO_SUCH_CARD' using errcode = 'no_data_found'; end if;
  update public.card_catalogue
     set hide_from_coming_soon = _hidden, updated_at = now(), updated_by = auth.uid()
   where card_key = _card_key;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'card_catalogue_changed', 'card', _card_key,
          jsonb_build_object('field', 'hide_from_coming_soon', 'from', coalesce(_old, false), 'to', _hidden));
end;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_card_coming_soon(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_card_coming_soon(text, boolean) TO authenticated;
