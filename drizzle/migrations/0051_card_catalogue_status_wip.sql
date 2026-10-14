ALTER TABLE public.card_catalogue ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'available';
ALTER TABLE public.card_catalogue DROP CONSTRAINT IF EXISTS card_catalogue_status_check;
ALTER TABLE public.card_catalogue ADD CONSTRAINT card_catalogue_status_check CHECK (status IN ('available','wip'));
COMMENT ON COLUMN public.card_catalogue.status IS 'available = offered; wip = work in progress: not offered through the single entitlement rule; ticks kept dormant.';

-- WIP rows are visible only to System Administrators (product copy only; no client data).
DROP POLICY IF EXISTS "card catalogue readable by signed-in users" ON public.card_catalogue;
CREATE POLICY "card catalogue readable by signed-in users" ON public.card_catalogue
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND (status = 'available' OR app_private.me_is_super_admin()));

CREATE OR REPLACE FUNCTION app_private.card_group_cards(_group text, _include_wip boolean)
 RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select coalesce(array(
    select c.card_key from public.card_catalogue c
     where c.package = _group and (_include_wip or c.status = 'available')
     order by c.sort_order, c.card_key
  ), '{}'::text[])
$$;
REVOKE EXECUTE ON FUNCTION app_private.card_group_cards(text, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.card_group_cards(_group text)
 RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ select app_private.card_group_cards(_group, false) $$;

CREATE OR REPLACE FUNCTION app_private.client_purchasable_cards(_client_id uuid, _include_wip boolean)
 RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  with c as (select cl.firm_id from public.clients cl where cl.id = _client_id),
  o as (select e.advisory, e.consolidation from app_private.org_effective_options((select firm_id from c)) e),
  siblings as (select count(*) as n from public.clients cl where cl.firm_id = (select firm_id from c)),
  lapsed as (select app_private.firm_subscription_lapsed((select firm_id from c)) as v)
  select coalesce(array(
    select distinct x from unnest(
      app_private.card_group_cards('standard', _include_wip)
      || case when coalesce((select advisory from o), false) and not (select v from lapsed)
              then app_private.card_group_cards('advisory', _include_wip) else '{}'::text[] end
      || case when coalesce((select consolidation from o), false)
                   and not (select v from lapsed)
                   and (select n from siblings) > 1
              then app_private.card_group_cards('consolidation', _include_wip) else '{}'::text[] end
    ) as x order by x
  ), '{}'::text[])
$function$;
REVOKE EXECUTE ON FUNCTION app_private.client_purchasable_cards(uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.client_available_cards(_client_id uuid)
 RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ select app_private.client_purchasable_cards(_client_id, false) $$;

CREATE OR REPLACE FUNCTION app_private.client_cards_v2(_client_id uuid)
 RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  available text[];
  ticked text[];
  result text[];
begin
  available := app_private.client_available_cards(_client_id);
  select cc.cards into ticked from public.client_cards cc where cc.client_id = _client_id;

  if ticked is null then
    result := available;
  else
    result := coalesce(array(
      select distinct x from unnest(available) as x where x = any(ticked) order by x
    ), '{}'::text[]);
  end if;

  -- Testing exception: a System Administrator sees purchased Work-in-progress
  -- cards only on a client they can already read. Never anyone else.
  if auth.uid() is not null
     and app_private.me_is_super_admin()
     and app_private.user_can_read_client(auth.uid(), _client_id) then
    result := coalesce(array(
      select distinct x from unnest(result || app_private.client_purchasable_cards(_client_id, true)) x order by x
    ), '{}'::text[]);
  end if;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.client_report_sections(_client_id uuid)
 RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _cards text[];
begin
  perform app_private.assert_aal2();
  _cards := public.client_visible_cards(_client_id);
  -- Work-in-progress cards never add report sections, even for a System Administrator.
  return coalesce(array(
    select distinct s from public.card_catalogue cc, unnest(cc.report_sections) s
    where cc.card_key = any(_cards) and cc.status = 'available' order by s
  ), '{}'::text[]);
end;
$function$;

CREATE OR REPLACE FUNCTION public.client_locked_modules(_client_id uuid)
 RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  _firm uuid; _cards text[]; _consolidation boolean; _client_count int; _out text[] := '{}';
begin
  perform app_private.assert_aal2();
  if auth.uid() is null then return '{}'; end if;
  select firm_id into _firm from public.clients where id = _client_id;
  if _firm is null
     or not app_private.user_can_read_client(auth.uid(), _client_id)
     or not public.me_can_manage_cards(_firm) then
    return '{}';
  end if;
  _cards := coalesce(app_private.client_cards_v2(_client_id), '{}');
  select coalesce(array_agg(m.module_key order by m.sort_order, m.module_key), '{}') into _out
    from public.card_modules m
   where exists (select 1 from public.card_catalogue c where c.module_key = m.module_key and c.package = 'advisory' and c.status = 'available')
     and not exists (select 1 from public.card_catalogue c
                      where c.module_key = m.module_key and c.package = 'advisory' and c.status = 'available' and c.card_key = any(_cards));
  select o.consolidation into _consolidation from app_private.org_effective_options(_firm) o;
  select count(*) into _client_count from public.clients where firm_id = _firm;
  if not coalesce(_consolidation, false) and _client_count > 1
     and exists (select 1 from public.card_catalogue c where c.package = 'consolidation' and c.status = 'available')
     and not exists (select 1 from public.card_catalogue c where c.package = 'consolidation' and c.status = 'available' and c.card_key = any(_cards)) then
    _out := array_append(_out, 'consolidation'::text);
  end if;
  return _out;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_website_settings()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select coalesce((
    select jsonb_build_object('calendlyUrl',b.website_settings->>'calendlyUrl','heroVideoPath',b.website_settings->>'heroVideoPath','heroPosterPath',b.website_settings->>'heroPosterPath','walkthroughUrl',b.website_settings->>'walkthroughUrl','standardPrice',b.website_settings->>'standardPrice','advisoryPrice',b.website_settings->>'advisoryPrice','consolidationPrice',b.website_settings->>'consolidationPrice','whiteLabelPrice',b.website_settings->>'whiteLabelPrice')
      from public.platform_branding b where b.id = true
  ), '{}'::jsonb)
  || jsonb_build_object(
    'packages', jsonb_build_object(
      'modules', coalesce((select jsonb_agg(jsonb_build_object('key', m.module_key, 'label', m.label, 'description', m.description) order by m.sort_order, m.module_key) from public.card_modules m
                            where exists (select 1 from public.card_catalogue c where c.module_key = m.module_key and c.status = 'available')), '[]'::jsonb),
      'cards', coalesce((select jsonb_agg(jsonb_build_object('package', c.package, 'module', c.module_key, 'label', c.label, 'description', c.description) order by c.sort_order, c.card_key) from public.card_catalogue c where c.status = 'available'), '[]'::jsonb)
    )
  )
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_card_status(_card_key text, _status text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _old text;
begin
  perform app_private.assert_aal2();
  perform public.assert_super_admin();
  if _status not in ('available','wip') then raise exception 'INVALID_STATUS' using errcode = 'check_violation'; end if;
  select status into _old from public.card_catalogue where card_key = _card_key for update;
  if not found then raise exception 'NO_SUCH_CARD' using errcode = 'no_data_found'; end if;
  update public.card_catalogue set status = _status, updated_at = now(), updated_by = auth.uid() where card_key = _card_key;
  insert into public.audit_log (actor_user_id, action, target_type, target_id, meta)
  values (auth.uid(), 'card_catalogue_status_changed', 'card', _card_key, jsonb_build_object('from', _old, 'to', _status));
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_set_card_status(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_card_status(text, text) TO authenticated;
GRANT SELECT (status) ON public.card_catalogue TO authenticated;