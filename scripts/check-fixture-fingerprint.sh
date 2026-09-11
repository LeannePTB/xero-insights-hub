#!/usr/bin/env bash
# Is tests/fixtures/rls-schema.sql still a faithful copy of the live catalogue?
#
# Read-only. Re-runs the dump into a temporary file and compares the
# `-- catalogue-fingerprint:` line. A mismatch means a policy, grant, table or
# authorisation function changed live since the fixture was generated, so every
# PGlite result is stale — regenerate with scripts/dump-rls-fixture.sh.
set -uo pipefail
cd "$(dirname "$0")/.."

fixture="tests/fixtures/rls-schema.sql"
have=$(grep -m1 '^-- catalogue-fingerprint: ' "$fixture" | awk '{print $3}')
if [ -z "${have:-}" ]; then
  echo "FINGERPRINT: FAIL — $fixture carries no fingerprint line."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1 || [ -z "${PGHOST:-}" ]; then
  echo "FINGERPRINT: SKIPPED — no database connection in this environment."
  echo "  fixture: $have"
  exit 0
fi

live=$(psql -q -t -A -f scripts/dump-rls-fixture.sql 2>/dev/null |
  grep -m1 '^-- catalogue-fingerprint: ' | awk '{print $3}')
if [ -z "${live:-}" ]; then
  echo "FINGERPRINT: FAIL — could not read the live catalogue."
  exit 1
fi

if [ "$have" = "$live" ]; then
  echo "FINGERPRINT: MATCH — $have"
  exit 0
fi

echo "FINGERPRINT: MISMATCH — the fixture is stale."
echo "  fixture: $have"
echo "  live   : $live"
echo "  run: ./scripts/dump-rls-fixture.sh"
exit 1
