-- Read-only snapshot of the card catalogue: the cards each purchasable group
-- offers, straight from app_private.card_group_cards.
--
-- Used by tests/card-catalogue.test.ts to prove every offerable card has a
-- component in the dashboard, and by scripts/check-card-catalogue.sh to prove
-- the snapshot itself is not stale after a migration.
select jsonb_pretty(
  jsonb_agg(
    jsonb_build_object('group', g, 'cards', to_jsonb(app_private.card_group_cards(g)))
    order by g
  )
)
from unnest(array['advisory', 'consolidation', 'standard']) as g;
