// TEMPORARY validation probe — deleted immediately after use.
import { createFileRoute } from "@tanstack/react-router";

const TOKEN = "b8f0c1d2-probe-2026-07-31";

export const Route = createFileRoute("/api/public/recon-probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("token") !== TOKEN) return new Response("nope", { status: 401 });
        const tenantId = url.searchParams.get("tenant")!;
        const asAt = url.searchParams.get("asAt")!;
        const what = url.searchParams.get("what") ?? "bs";
        const { getConnectionByTenant } = await import("@/lib/xero/api.server");
        const conn = await getConnectionByTenant(tenantId);
        let out: unknown;
        if (what === "bs") {
          const { computeBalanceSheetReconciliation } = await import("@/lib/xero/reconciliation.server");
          out = await computeBalanceSheetReconciliation(conn, asAt);
        } else if (what === "fa") {
          const { computeFixedAssetsReconciliation } = await import("@/lib/xero/fixed-assets.server");
          out = await computeFixedAssetsReconciliation(conn, asAt);
        } else {
          const { computeGstReconciliation } = await import("@/lib/xero/gst.server");
          out = await computeGstReconciliation(conn, asAt);
        }
        return new Response(JSON.stringify(out, null, 2), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
