#!/usr/bin/env bash
# Is tests/fixtures/card-catalogue.json still a faithful copy of the live card
# catalogue?
#
# Read-only. A mismatch means a migration changed which cards a purchasable
# group offers, so the offline test in tests/card-catalogue.test.ts is checking
# the app's components against a stale catalogue — the gap that let
# bank_reconciliation and tax_liability stay tickable for months while drawing
# nothing.
set -uo pipefail
cd "$(dirname "$0")/.."

fixture="tests/fixtures/card-catalogue.json"
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

if diff -q "$fixture" "$live" >/dev/null; then
  echo "CARD CATALOGUE: MATCH — snapshot agrees with the live catalogue."
  exit 0
fi

echo "CARD CATALOGUE: MISMATCH — the snapshot is stale (a group's cards changed live)."
diff "$fixture" "$live" | head -40
echo "  run: ./scripts/dump-card-catalogue.sh"
exit 1
