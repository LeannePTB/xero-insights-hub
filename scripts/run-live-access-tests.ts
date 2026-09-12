/**
 * `bun run security:check` entry point for the SLIM LIVE SMOKE SUITE.
 *
 * The suite itself runs on the server (it needs real sessions and the real
 * server functions), so this script only triggers it and reports the result.
 *
 * It SKIPS — without failing the check — when the trigger secret is not present
 * in the environment, which is the normal case on a developer machine. The
 * PGlite matrix, which proves 1,395 rules, has already run by this point.
 *
 * Environment:
 *   SECURITY_TEST_TRIGGER_SECRET  the one owner-added secret
 *   SECURITY_TEST_BASE_URL        optional; defaults to the published site
 */

const secret = process.env["SECURITY_TEST_TRIGGER_SECRET"];
const base =
  process.env["SECURITY_TEST_BASE_URL"] ??
  process.env["SITE_URL"] ??
  "https://tractionadvisory.com.au";

if (!secret) {
  console.log(
    "live access tests: SKIPPED (no SECURITY_TEST_TRIGGER_SECRET in this environment).",
  );
  process.exit(0);
}

const res = await fetch(`${base.replace(/\/+$/, "")}/api/public/security/run-access-tests`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});

const text = await res.text();
if (!res.ok) {
  console.error(`live access tests: FAILED to trigger (${res.status}) ${text.slice(0, 300)}`);
  process.exit(1);
}

const body = JSON.parse(text) as {
  passed: number;
  failed: number;
  inconclusive: number;
  failures: { role: string; resource: string; operation: string; expected: string; observed: string }[];
};

console.log(
  `live access tests: ${body.passed} passed, ${body.failed} failed, ${body.inconclusive} inconclusive`,
);
for (const f of body.failures) {
  console.error(`  FAIL ${f.role} / ${f.resource} / ${f.operation}: expected ${f.expected}, got ${f.observed}`);
}
process.exit(body.failed > 0 ? 1 : 0);
