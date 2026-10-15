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
    select c.module_key, c.card_key, c.label as name into _entry
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