CREATE TABLE public.org_early_access (
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  card_key text NOT NULL REFERENCES public.card_catalogue(card_key) ON UPDATE CASCADE ON DELETE CASCADE,
  granted_by uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  PRIMARY KEY (firm_id, card_key)
);
REVOKE ALL ON public.org_early_access FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.org_early_access TO authenticated;
GRANT ALL ON public.org_early_access TO service_role;
ALTER TABLE public.org_early_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY mfa_aal2_required ON public.org_early_access AS RESTRICTIVE FOR ALL TO authenticated
  USING (app_private.is_aal2()) WITH CHECK (app_private.is_aal2());
CREATE POLICY org_early_access_super_admin_select ON public.org_early_access FOR SELECT TO authenticated
  USING (app_private.me_is_super_admin());

-- Work-in-progress cards an organisation currently has early access to.
CREATE OR REPLACE FUNCTION app_private.firm_early_access_cards(_firm_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select coalesce(array(
    select e.card_key from public.org_early_access e
      join public.card_catalogue c on c.card_key = e.card_key
     where e.firm_id = _firm_id and c.status = 'wip'
       and e.revoked_at is null and (e.ends_at is null or e.ends_at > now())
     order by e.card_key), '{}'::text[])
$$;
REVOKE EXECUTE ON FUNCTION app_private.firm_early_access_cards(uuid) FROM PUBLIC, anon, authenticated;

-- Early-access cards the purchase allows for this client, for a practice member
-- (active firm_members row of the client's organisation) who can read the client.
-- Never Business Owners, Viewers or support grants.
CREATE OR REPLACE FUNCTION app_private.client_early_access_for_caller(_client_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select case when auth.uid() is not null
     and app_private.user_can_read_client(auth.uid(), _client_id)
     and (app_private.me_is_super_admin() or exists (
       select 1 from public.firm_members m join public.clients cl on cl.firm_id = m.firm_id
        where cl.id = _client_id and m.user_id = auth.uid() and m.status = 'active'))
  then coalesce(array(
    select x from unnest(app_private.firm_early_access_cards((select firm_id from public.clients where id = _client_id))) x
     where x = any(app_private.client_purchasable_cards(_client_id, true)) order by x), '{}'::text[])
  else '{}'::text[] end
$$;
REVOKE EXECUTE ON FUNCTION app_private.client_early_access_for_caller(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.client_cards_v2(_client_id uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
declare available text[]; ticked text[]; result text[]; early text[];
begin
  available := app_private.client_available_cards(_client_id);
  select cc.cards into ticked from public.client_cards cc where cc.client_id = _client_id;
  if ticked is null then result := available;
  else
    result := coalesce(array(select distinct x from unnest(available) as x where x = any(ticked) order by x), '{}'::text[]);
  end if;

  -- Early access: a WIP card the organisation may try behaves as Available for
  -- that organisation's practice members only, and only when ticked for the client.
  if ticked is not null then
    early := app_private.client_early_access_for_caller(_client_id);
    result := coalesce(array(select distinct x from unnest(result || array(select e from unnest(early) e where e = any(ticked))) x order by x), '{}'::text[]);
  end if;

  -- Testing exception: a System Administrator sees purchased Work-in-progress
  -- cards only on a client they can already read. Never anyone else.
  if auth.uid() is not null and app_private.me_is_super_admin()
     and app_private.user_can_read_client(auth.uid(), _client_id) then
    result := coalesce(array(select distinct x from unnest(result || app_private.client_purchasable_cards(_client_id, true)) x order by x), '{}'::text[]);
  end if;
  return result;
end;
$function$;

-- Catalogue rows for this client's early-access cards (caller-scoped).
CREATE OR REPLACE FUNCTION public.client_early_access_cards(_client_id uuid)
RETURNS TABLE(card_key text, package text, module_key text, label text, description text, sort_order integer, report_sections text[], status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  perform app_private.assert_aal2();
  return query
    select c.card_key, c.package, c.module_key, c.label, c.description, c.sort_order, c.report_sections, c.status
      from public.card_catalogue c
     where c.card_key = any(app_private.client_early_access_for_caller(_client_id))
     order by c.sort_order, c.card_key;
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.client_early_access_cards(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_early_access_cards(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_client_card_enabled(_client_id uuid, _card text, _enabled boolean)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare _base text[]; _firm uuid; _avail text[];
begin
  perform app_private.assert_aal2();
  select c.firm_id into _firm from public.clients c where c.id = _client_id;
  if not found then raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege'; end if;
  perform app_private.assert_card_manager(_firm);
  if _card is null or _card = '' then raise exception 'INVALID_CARD' using errcode = 'check_violation'; end if;
  _avail := app_private.client_available_cards(_client_id);
  if coalesce(_enabled,false)
     and not (_card = any(_avail || app_private.client_early_access_for_caller(_client_id))) then
    raise exception 'CARD_NOT_AVAILABLE' using errcode = 'check_violation';
  end if;
  select cc.cards into _base from public.client_cards cc where cc.client_id = _client_id;
  if _base is null then _base := _avail; end if;
  if coalesce(_enabled,false) then _base := _base || array[_card]; else _base := array_remove(_base, _card); end if;
  perform app_private.set_client_cards(_client_id, _base);
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm, 'client_card_toggled', 'client', _client_id::text,
          jsonb_build_object('card', _card, 'enabled', coalesce(_enabled,false)));
  return app_private.client_cards_v2(_client_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_client_module(_client_id uuid, _module_key text, _enabled boolean)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare _firm uuid; _cards text[]; _avail text[]; _allow text[]; _base text[];
begin
  perform app_private.assert_aal2();
  select c.firm_id into _firm from public.clients c where c.id = _client_id;
  if not found then raise exception 'NO_ACCESS' using errcode = 'insufficient_privilege'; end if;
  perform app_private.assert_card_manager(_firm);
  select coalesce(array(select cc.card_key from public.card_catalogue cc where cc.module_key = _module_key), '{}'::text[]) into _cards;
  if cardinality(_cards) = 0 then raise exception 'NO_SUCH_MODULE' using errcode = 'check_violation'; end if;
  _avail := app_private.client_available_cards(_client_id);
  _allow := _avail || app_private.client_early_access_for_caller(_client_id);
  if coalesce(_enabled, false) and not (_cards && _allow) then
    raise exception 'CARD_NOT_AVAILABLE' using errcode = 'check_violation';
  end if;
  select x.cards into _base from public.client_cards x where x.client_id = _client_id;
  if _base is null then _base := _avail; end if;
  if coalesce(_enabled, false) then
    _base := _base || array(select u from unnest(_cards) u where u = any(_allow));
  else
    _base := array(select u from unnest(_base) u where not (u = any(_cards)));
  end if;
  perform app_private.set_client_cards(_client_id, _base);
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm, 'client_module_toggled', 'client', _client_id::text,
          jsonb_build_object('module', _module_key, 'enabled', coalesce(_enabled, false)));
  return app_private.client_cards_v2(_client_id);
end;
$function$;

-- Apply defaults never wipes ticks for Work-in-progress (incl. early-access) cards.
CREATE OR REPLACE FUNCTION public.apply_org_card_defaults(_firm_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare _cards text[]; _client uuid; _n int := 0; _keep text[];
begin
  perform app_private.assert_aal2();
  perform app_private.assert_card_manager(_firm_id);
  select d.cards into _cards from public.org_card_defaults d where d.firm_id = _firm_id;
  if _cards is null then raise exception 'NO_DEFAULT_SET' using errcode = 'no_data_found'; end if;
  for _client in select c.id from public.clients c where c.firm_id = _firm_id loop
    select coalesce(array(select x from unnest(cc.cards) x
             where x in (select card_key from public.card_catalogue where status = 'wip')), '{}'::text[])
      into _keep from public.client_cards cc where cc.client_id = _client;
    perform app_private.set_client_cards(_client, _cards || coalesce(_keep, '{}'::text[]));
    _n := _n + 1;
  end loop;
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm_id, 'org_card_defaults_applied', 'firm', _firm_id::text,
          jsonb_build_object('clients_changed', _n, 'cards', to_jsonb(_cards), 'wip_ticks_kept', true));
  return _n;
end;
$function$;

-- System Administrator: list WIP cards with this organisation's early-access state.
CREATE OR REPLACE FUNCTION public.admin_org_early_access(_firm_id uuid)
RETURNS TABLE(card_key text, label text, module_label text, granted boolean, active boolean, ends_at timestamptz, granted_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  return query
    select c.card_key, c.label, m.label,
           (e.firm_id is not null and e.revoked_at is null),
           (e.firm_id is not null and e.revoked_at is null and (e.ends_at is null or e.ends_at > now())),
           case when e.revoked_at is null then e.ends_at end,
           case when e.revoked_at is null then e.granted_at end
      from public.card_catalogue c
      left join public.card_modules m on m.module_key = c.module_key
      left join public.org_early_access e on e.card_key = c.card_key and e.firm_id = _firm_id
     where c.status = 'wip'
     order by c.sort_order, c.card_key;
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_org_early_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_org_early_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_org_early_access(_firm_id uuid, _card_key text, _enabled boolean, _ends_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  if not exists (select 1 from public.firms where id = _firm_id) then raise exception 'NO_SUCH_ORGANISATION' using errcode = 'no_data_found'; end if;
  if not exists (select 1 from public.card_catalogue where card_key = _card_key and status = 'wip') then
    raise exception 'NOT_WORK_IN_PROGRESS' using errcode = 'check_violation';
  end if;
  if coalesce(_enabled, false) then
    if _ends_at is not null and _ends_at <= now() then raise exception 'END_DATE_IN_PAST' using errcode = 'check_violation'; end if;
    insert into public.org_early_access (firm_id, card_key, granted_by, granted_at, ends_at)
    values (_firm_id, _card_key, auth.uid(), now(), _ends_at)
    on conflict (firm_id, card_key) do update
      set granted_by = auth.uid(), granted_at = now(), ends_at = excluded.ends_at, revoked_at = null, revoked_by = null;
  else
    update public.org_early_access set revoked_at = now(), revoked_by = auth.uid()
     where firm_id = _firm_id and card_key = _card_key and revoked_at is null;
  end if;
  insert into public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  values (auth.uid(), _firm_id, case when coalesce(_enabled,false) then 'org_early_access_granted' else 'org_early_access_revoked' end,
          'card', _card_key, jsonb_build_object('ends_at', case when coalesce(_enabled,false) then _ends_at end));
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_set_org_early_access(uuid, text, boolean, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_org_early_access(uuid, text, boolean, timestamptz) TO authenticated;