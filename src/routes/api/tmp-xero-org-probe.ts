import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tmp-xero-org-probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const tenantId = url.searchParams.get("tenantId")!;
        const { getConnectionByTenant, xeroGet } = await import("@/lib/xero/api.server");
        const conn = await getConnectionByTenant(tenantId);
        const org = await xeroGet<{ Organisations?: any[] }>(conn, "Organisation");
        return Response.json(org.Organisations?.[0] ?? null);
      },
    },
  },
});
