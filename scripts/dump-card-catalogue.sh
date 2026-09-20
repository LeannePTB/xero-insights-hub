#!/usr/bin/env bash
# Regenerate tests/fixtures/card-catalogue.json from the live catalogue
# (read-only). Run this after any migration that adds or removes a card from
# app_private.card_group_cards — scripts/check-card-catalogue.sh fails until you
# do.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v psql >/dev/null 2>&1 || [ -z "${PGHOST:-}" ]; then
  echo "card catalogue: cannot dump — no database connection in this environment." >&2
  exit 1
fi

out="tests/fixtures/card-catalogue.json"
psql -q -t -A -f scripts/dump-card-catalogue.sql >"$out.tmp"
if [ ! -s "$out.tmp" ]; then
  rm -f "$out.tmp"
  echo "card catalogue: the live catalogue returned nothing." >&2
  exit 1
fi
mv "$out.tmp" "$out"
echo "card catalogue: wrote $out."
