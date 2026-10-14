ALTER TABLE public.card_catalogue ADD COLUMN IF NOT EXISTS report_sections text[] NOT NULL DEFAULT '{}'::text[];
COMMENT ON COLUMN public.card_catalogue.report_sections IS 'Monthly report sections a new draft includes only when this card is visible for the client.';
UPDATE public.card_catalogue SET report_sections = ARRAY['key_figures','profit_and_loss','charts'] WHERE card_key = 'pnl';
UPDATE public.card_catalogue SET report_sections = ARRAY['receivables'] WHERE card_key = 'receivables';
UPDATE public.card_catalogue SET report_sections = ARRAY['payables'] WHERE card_key = 'payables';
UPDATE public.card_catalogue SET report_sections = ARRAY['verdict'] WHERE card_key = 'health';
UPDATE public.card_catalogue SET report_sections = ARRAY['notes'] WHERE card_key = 'notes';

CREATE OR REPLACE FUNCTION app_private.can_open_loans(_user_id uuid, _firm_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select _user_id is not null and _firm_id is not null
     and _user_id = auth.uid()
     and (app_private.is_firm_owner(_user_id, _firm_id) or app_private.is_practice_member_of(_user_id, _firm_id))
$$;
REVOKE ALL ON FUNCTION app_private.can_open_loans(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.can_open_loans(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.me_can_open_consolidations(_firm_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  perform app_private.assert_aal2();
  if auth.uid() is null or _firm_id is null then return false; end if;
  if not app_private.can_open_loans(auth.uid(), _firm_id) then return false; end if;
  return public.firm_can_use_widget(_firm_id, 'loan_consolidation');
end;
$$;
REVOKE ALL ON FUNCTION public.me_can_open_consolidations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.me_can_open_consolidations(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.me_can_open_client_loans(_client_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
declare _firm uuid;
begin
  perform app_private.assert_aal2();
  if auth.uid() is null or _client_id is null then return false; end if;
  select c.firm_id into _firm from public.clients c where c.id = _client_id;
  if _firm is null then return false; end if;
  if not public.me_can_open_consolidations(_firm) then return false; end if;
  if not exists (
    select 1 from public.consolidation_group_members m
    join public.consolidation_groups g on g.id = m.group_id
    where m.client_id = _client_id and g.firm_id = _firm
  ) then return false; end if;
  return 'loan_consolidation' = any(app_private.client_cards_v2(_client_id));
end;
$$;
REVOKE ALL ON FUNCTION public.me_can_open_client_loans(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.me_can_open_client_loans(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.client_report_sections(_client_id uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
declare _cards text[];
begin
  perform app_private.assert_aal2();
  _cards := public.client_visible_cards(_client_id);
  return coalesce(array(
    select distinct s from public.card_catalogue cc, unnest(cc.report_sections) s
    where cc.card_key = any(_cards) order by s
  ), '{}'::text[]);
end;
$$;
REVOKE ALL ON FUNCTION public.client_report_sections(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_report_sections(uuid) TO authenticated;