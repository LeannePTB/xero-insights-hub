-- Read-only: every distinct card key any client currently has ticked, plus every
-- key in an organisation's card template.
--
-- Used by scripts/check-card-catalogue.sh to prove no client holds a ticked card
-- the catalogue no longer offers — the reverse of the check in
-- tests/card-catalogue.test.ts, which proves the catalogue offers no card the
-- app cannot draw. A ticked key with no catalogue entry is the same class of
-- fault: a stored choice that nothing can honour.
select distinct card
from (
  select unnest(cards) as card from public.client_cards
  union all
  select unnest(cards) as card from public.org_card_defaults
) k
order by card;
