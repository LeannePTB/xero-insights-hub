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

const TRIGGER_LIMIT = { max: 6, windowSeconds: 3_600 } as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

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
          return json({ error: "Not configured" }, 503);
        }

        const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!provided || !constantTimeEquals(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { enforceRateLimit } = await import("@/lib/rate-limit.server");
        try {
          // Six trigger attempts per fixed 3,600-second bucket, app-wide. This
          // is the suite trigger's own global guard, not the auth provider's
          // per-IP password-sign-in limit. A rate-limited trigger means the run
          // did not start and must be reported as inconclusive, never green.
          await enforceRateLimit("security_access_tests:global", TRIGGER_LIMIT.max, TRIGGER_LIMIT.windowSeconds);
        } catch {
          return json(
            {
              error: "Rate limited",
              completed: false,
              incompleteReason:
                "INCONCLUSIVE — run did not complete: live access-test trigger rate limited before sign-in.",
              limit: TRIGGER_LIMIT,
            },
            429,
          );
        }

        try {
          const { runLiveAccessTests } = await import("@/lib/live-access-tests.server");
          const summary = await runLiveAccessTests(null);
          return json({
            runId: summary.runId,
            passed: summary.passed,
            failed: summary.failed,
            inconclusive: summary.inconclusive,
            completed: summary.completed,
            incompleteReason: summary.incompleteReason,
            failures: summary.probes
              .filter((p) => !p.passed)
              .map((p) => ({
                role: p.role,
                resource: p.resource,
                operation: p.operation,
                expected: p.expected,
                observed: p.observed,
                detail: p.detail,
              })),
          });
        } catch (e) {
          console.error("[run-access-tests] run failed:", e instanceof Error ? e.message : e);
          return json({ error: "The access-test run failed." }, 500);
        }
      },
    },
  },
});
