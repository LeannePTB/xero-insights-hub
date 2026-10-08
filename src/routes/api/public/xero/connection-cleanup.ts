// Scheduled Xero connection cleanup endpoint (Xero certification: unused or
// expired connections must be removed). Same security shape as the
// snapshot-refresh route: /api/public/* is reachable without a site session,
// so the bearer check below IS the security boundary.
//
// DRY-RUN BY DEFAULT: until XERO_CONNECTION_CLEANUP_LIVE="true" is set, this
// reports what it would detach and changes nothing at Xero.

import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

function constantTimeEquals(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const Route = createFileRoute("/api/public/xero/connection-cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["SUPABASE_SERVICE_ROLE_KEY"];
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
          // At most a handful of runs per day; this job is scheduled, not interactive.
          await enforceRateLimit("xero_connection_cleanup:global", 6, 86_400);
        } catch {
          return new Response(JSON.stringify({ error: "Rate limited" }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { cleanupXeroConnections } = await import("@/lib/xero/connection-cleanup.server");
        try {
          const report = await cleanupXeroConnections();
          return new Response(JSON.stringify(report), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Cleanup failed";
          console.error("[connection-cleanup] run failed:", message);
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
