-- Read-only snapshot of the card catalogue: the body of
-- app_private.card_group_cards, which is the one place the cards each
-- purchasable group offers are defined.
--
-- Read from pg_proc rather than by calling the function, because the dumping
-- role has no USAGE on app_private — and should not be given any.
--
-- Used by tests/card-catalogue.test.ts to prove every offerable card has a
-- component in the dashboard, and by scripts/check-card-catalogue.sh to prove
-- the snapshot itself is not stale after a migration.
select p.prosrc
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app_private'
  and p.proname = 'card_group_cards';
