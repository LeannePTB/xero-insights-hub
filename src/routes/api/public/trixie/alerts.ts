// Scheduled Trixie usage alerts and monthly summary.
// /api/public/* is reachable without a site session, so the constant-time
// bearer check below IS the security boundary (same shape as the Xero
// connection-cleanup job). Only Trixie usage metadata is read.

import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

function constantTimeEquals(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/public/trixie/alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        if (!expected) return json({ error: "Not configured" }, 503);
        const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!provided || !constantTimeEquals(provided, expected)) return new Response("Unauthorized", { status: 401 });

        let job: "alerts" | "monthly" = "alerts";
        try {
          const body = (await request.json()) as { job?: unknown };
          if (body?.job === "monthly") job = "monthly";
        } catch {
          /* default job */
        }

        const { enforceRateLimit } = await import("@/lib/rate-limit.server");
        try {
          await enforceRateLimit(`trixie_${job}:global`, job === "monthly" ? 3 : 30, 86_400);
        } catch {
          return json({ error: "Rate limited" }, 429);
        }

        const { runTrixieAlertCheck, runTrixieMonthlySummary } = await import("@/lib/trixie/trixie-alerts.server");
        try {
          return json(job === "monthly" ? await runTrixieMonthlySummary() : await runTrixieAlertCheck());
        } catch (e) {
          console.error("[trixie-alerts] run failed:", e instanceof Error ? e.message : "unknown");
          return json({ error: "Run failed" }, 500);
        }
      },
    },
  },
});
