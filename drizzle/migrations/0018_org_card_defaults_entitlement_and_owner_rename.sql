CREATE OR REPLACE FUNCTION public.set_org_card_defaults(_firm_id uuid, _cards text[])
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _clean text[];
  _allowed text[];
  _adv boolean;
  _cons boolean;
  _n int;
begin
  perform app_private.assert_aal2();
  perform app_private.assert_firm_member_write(_firm_id);

  if not exists (select 1 from public.firms f where f.id = _firm_id) then
    raise exception 'NO_SUCH_ORGANISATION' using errcode = 'no_data_found';
  end if;

  -- Entitlement: the same groups the purchase screen offers.
  select e.advisory, e.consolidation into _adv, _cons from app_private.org_effective_options(_firm_id) e;
  select count(*)::int into _n from public.clients c where c.firm_id = _firm_id;
  _allowed := app_private.card_group_cards('standard')
    || case when coalesce(_adv, false) then app_private.card_group_cards('advisory') else '{}'::text[] end
    || case when coalesce(_cons, false) and _n > 1 then app_private.card_group_cards('consolidation') else '{}'::text[] end;

  _clean := coalesce(array(
    select distinct x from unnest(coalesce(_cards, '{}'::text[])) x
     where x = any(app_private.known_cards())
       and x = any(_allowed)
     order by x
  ), '{}'::text[]);

  insert into public.org_card_defaults (firm_id, cards)
  values (_firm_id, _clean)
  on conflict (firm_id) do update set cards = excluded.cards, updated_at = now();

  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm_id, 'org_card_defaults_set', 'firm', _firm_id::text,
          jsonb_build_object('cards', to_jsonb(_clean)));

  return _clean;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rename_my_organisation(_firm_id uuid, _name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _clean text := btrim(coalesce(_name, ''));
  _old text;
begin
  perform app_private.assert_aal2();
  if auth.uid() is null or _firm_id is null then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;
  -- Owner only: the organisation's name is an ownership-level decision.
  select f.name into _old from public.firms f
   where f.id = _firm_id and f.owner_user_id = auth.uid();
  if not found then
    raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege';
  end if;
  if char_length(_clean) < 2 or char_length(_clean) > 120 then
    raise exception 'INVALID_NAME' using errcode = 'check_violation';
  end if;
  update public.firms set name = _clean where id = _firm_id;
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm_id, 'organisation_renamed_by_owner', 'firm', _firm_id::text,
          jsonb_build_object('from', _old, 'to', _clean));
  return _clean;
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.rename_my_organisation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_my_organisation(uuid, text) TO authenticated;