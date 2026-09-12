// Trigger endpoint for the slim live access-test suite.
//
// Reachable without a site session (that is what /api/public/* means), so the
// constant-time secret check below IS the security boundary. It carries a
// single owner-added secret, SECURITY_TEST_TRIGGER_SECRET, and is rate limited
// before it does any work so holding the secret cannot be used to loop runs.
//
// It returns counts only — never a token, a password, a TOTP secret, an email
// address or anything about a real organisation.

import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

function constantTimeEquals(a: string, b: string): boolean {
  // Hash first so the comparison is over fixed-length buffers: timingSafeEqual
  // throws on a length mismatch, which would itself leak the secret's length.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const Route = createFileRoute("/api/public/security/run-access-tests")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["SECURITY_TEST_TRIGGER_SECRET"];
        if (!expected) {
          return new Response(JSON.stringify({ error: "Not configured" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }

        const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!provided || !constantTimeEquals(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { enforceRateLimit } = await import("@/lib/rate-limit.server");
        try {
          // Six runs an hour, app-wide. A run signs accounts in and out, so it
          // is never something to allow in a loop.
          await enforceRateLimit("security_access_tests:global", 6, 3600);
        } catch {
          return new Response(JSON.stringify({ error: "Rate limited" }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { runLiveAccessTests } = await import("@/lib/live-access-tests.server");
          const summary = await runLiveAccessTests(null);
          return new Response(
            JSON.stringify({
              runId: summary.runId,
              passed: summary.passed,
              failed: summary.failed,
              inconclusive: summary.inconclusive,
              failures: summary.probes
                .filter((p) => !p.passed)
                .map((p) => ({
                  role: p.role,
                  resource: p.resource,
                  operation: p.operation,
                  expected: p.expected,
                  observed: p.observed,
                })),
            }),
            { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
          );
        } catch (e) {
          console.error("[run-access-tests] run failed:", e instanceof Error ? e.message : e);
          return new Response(JSON.stringify({ error: "The access-test run failed." }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
