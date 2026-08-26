// Scheduled Xero snapshot refresh endpoint.
//
// Reachable without a site session (that is what /api/public/* means), so the
// bearer check below IS the security boundary. It follows the same shape as
// the email queue dispatch route; the deviations are noted inline.

import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

function constantTimeEquals(a: string, b: string): boolean {
  // Hash first so the comparison is over fixed-length buffers: timingSafeEqual
  // throws on a length mismatch, which would itself leak the secret's length.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const Route = createFileRoute("/api/public/xero/snapshot-refresh")({
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
        // Unauthenticated callers get a bare 401 with no detail: nothing about
        // tenants, schedules or whether the endpoint did any work.
        if (!provided || !constantTimeEquals(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { GLOBAL_RUN_MAX, GLOBAL_RUN_WINDOW_SECONDS } = await import("@/lib/xero/snapshot-keys");
        const { enforceRateLimit } = await import("@/lib/rate-limit.server");

        // Throttled BEFORE any Xero call, so even a caller holding the secret
        // cannot use this route to burn the app-wide daily quota by looping.
        try {
          await enforceRateLimit("xero_snapshot_refresh:global", GLOBAL_RUN_MAX, GLOBAL_RUN_WINDOW_SECONDS);
        } catch {
          return new Response(JSON.stringify({ error: "Rate limited" }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { refreshAllTenants } = await import("@/lib/xero/snapshot-refresh.server");
        try {
          const summary = await refreshAllTenants();
          return new Response(JSON.stringify(summary), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Refresh failed";
          console.error("[snapshot-refresh] run failed:", message);
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
