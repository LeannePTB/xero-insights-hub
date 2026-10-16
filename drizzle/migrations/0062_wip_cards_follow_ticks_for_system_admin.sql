-- Remove the System Administrator testing exception: Work-in-progress cards
-- now show only through a live early-access grant plus a client tick, for
-- everyone. Narrows access only; grants unchanged.
CREATE OR REPLACE FUNCTION app_private.client_cards_v2(_client_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  return result;
end;
$function$;