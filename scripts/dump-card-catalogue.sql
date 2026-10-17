-- Read-only snapshot of the card catalogue: public.card_catalogue, the one
-- place the cards each purchasable package offers are defined (read by
-- app_private.card_group_cards). Emitted in the "WHEN 'group' THEN ARRAY[...]"
-- shape tests/card-catalogue.test.ts parses. Retired cards are offered nowhere, so excluded.
select string_agg(format('WHEN %L THEN ARRAY[%s]', package, cards), E'\n' order by package)
from (
  select package, string_agg(quote_literal(card_key), ',' order by sort_order, card_key) as cards
  from public.card_catalogue where status <> 'retired' group by package
) t;
