#!/usr/bin/env bash
# Is tests/fixtures/rpc-signatures.json still a faithful copy of the live
# function signatures?
#
# Read-only. A mismatch means a migration changed a function's arguments, so the
# offline test in tests/rpc-signatures.test.ts is checking app calls against a
# stale contract — exactly the gap that let a five-argument set_org_trial call
# reach the owner after the sixth argument was added.
set -uo pipefail
cd "$(dirname "$0")/.."

fixture="tests/fixtures/rpc-signatures.json"
if [ ! -s "$fixture" ]; then
  echo "RPC SIGNATURES: FAIL — $fixture is missing. Run ./scripts/dump-rpc-signatures.sh"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1 || [ -z "${PGHOST:-}" ]; then
  echo "RPC SIGNATURES: SKIPPED — no database connection in this environment."
  exit 0
fi

live=$(mktemp)
trap 'rm -f "$live"' EXIT
psql -q -t -A -f scripts/dump-rpc-signatures.sql >"$live" 2>/dev/null
if [ ! -s "$live" ]; then
  echo "RPC SIGNATURES: FAIL — could not read the live catalogue."
  exit 1
fi

if diff -q "$fixture" "$live" >/dev/null; then
  echo "RPC SIGNATURES: MATCH — $(grep -c '"name"' "$fixture") functions."
  exit 0
fi

echo "RPC SIGNATURES: MISMATCH — the snapshot is stale (a function's arguments changed live)."
diff "$fixture" "$live" | head -40
echo "  run: ./scripts/dump-rpc-signatures.sh"
exit 1
