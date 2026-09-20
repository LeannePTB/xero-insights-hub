#!/usr/bin/env bash
# Is tests/fixtures/card-catalogue.sql still a faithful copy of the live card
# catalogue?
#
# Read-only. A mismatch means a migration changed which cards a purchasable
# group offers, so the offline test in tests/card-catalogue.test.ts is checking
# the app's components against a stale catalogue — the gap that let
# bank_reconciliation and tax_liability stay tickable for months while drawing
# nothing.
set -uo pipefail
cd "$(dirname "$0")/.."

fixture="tests/fixtures/card-catalogue.sql"
if [ ! -s "$fixture" ]; then
  echo "CARD CATALOGUE: FAIL — $fixture is missing. Run ./scripts/dump-card-catalogue.sh"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1 || [ -z "${PGHOST:-}" ]; then
  echo "CARD CATALOGUE: SKIPPED — no database connection in this environment."
  exit 0
fi

live=$(mktemp)
trap 'rm -f "$live"' EXIT
psql -q -t -A -f scripts/dump-card-catalogue.sql >"$live" 2>/dev/null
if [ ! -s "$live" ]; then
  echo "CARD CATALOGUE: FAIL — could not read the live catalogue."
  exit 1
fi

status=0

if diff -q "$fixture" "$live" >/dev/null; then
  echo "CARD CATALOGUE: MATCH — snapshot agrees with the live catalogue."
else
  echo "CARD CATALOGUE: MISMATCH — the snapshot is stale (a group's cards changed live)."
  diff "$fixture" "$live" | head -40
  echo "  run: ./scripts/dump-card-catalogue.sh"
  status=1
fi

# Reverse direction: a ticked card the catalogue no longer offers. Same class of
# fault as an offered card with no component — a stored choice nothing honours.
offered=$(grep -o "'[a-z_]*'" "$live" | tr -d "'" | sort -u)
ticked=$(psql -q -t -A -f scripts/dump-ticked-cards.sql 2>/dev/null | sed '/^$/d' | sort -u)
if [ -z "$ticked" ]; then
  echo "TICKED CARDS: SKIPPED — no ticked cards could be read."
else
  orphans=$(comm -23 <(echo "$ticked") <(echo "$offered"))
  if [ -n "$orphans" ]; then
    echo "TICKED CARDS: FAIL — clients hold ticked cards the catalogue does not offer:"
    echo "$orphans" | sed 's/^/  - /'
    echo "  either restore the key to app_private.card_group_cards, or remove it from"
    echo "  every client's ticked list and org template in one audited migration."
    status=1
  else
    echo "TICKED CARDS: OK — every ticked card is offered by the catalogue."
  fi
fi

exit $status

