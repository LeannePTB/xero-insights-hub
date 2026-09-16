#!/usr/bin/env bash
# Regenerate tests/fixtures/rpc-signatures.json from the live catalogue
# (read-only). Run this after any migration that adds, renames or removes a
# function argument — scripts/check-rpc-signatures.sh fails until you do.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v psql >/dev/null 2>&1 || [ -z "${PGHOST:-}" ]; then
  echo "rpc signatures: cannot dump — no database connection in this environment." >&2
  exit 1
fi

out="tests/fixtures/rpc-signatures.json"
psql -q -t -A -f scripts/dump-rpc-signatures.sql >"$out.tmp"
if [ ! -s "$out.tmp" ]; then
  rm -f "$out.tmp"
  echo "rpc signatures: the live catalogue returned nothing." >&2
  exit 1
fi
mv "$out.tmp" "$out"
echo "rpc signatures: wrote $out ($(grep -c '"name"' "$out") functions)."
