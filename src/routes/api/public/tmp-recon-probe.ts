// TEMPORARY verification endpoint — deleted immediately after the one-off
// 30 June reconciliation check. Requires a one-time shared token.
import { createFileRoute } from "@tanstack/react-router";

const TOKEN = "b1f0c2a7-probe-9d4e-only";

export const Route = createFileRoute("/api/public/tmp-recon-probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("t") !== TOKEN) return new Response("nope", { status: 404 });
        const tenantId = url.searchParams.get("tenant") ?? "";
        const asAt = url.searchParams.get("asAt") ?? "2026-06-30";
        try {
          const { getConnectionByTenant } = await import("@/lib/xero/api.server");
          const { computeBalanceSheetReconciliation } = await import(
            "@/lib/xero/reconciliation.server"
          );
          const conn = await getConnectionByTenant(tenantId);
          const result = await computeBalanceSheetReconciliation(conn, asAt);
          return Response.json(result);
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
        }
      },
    },
  },
});
