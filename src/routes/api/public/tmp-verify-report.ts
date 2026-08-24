// TEMPORARY local verification endpoint — deleted immediately after use.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tmp-verify-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as any;
        if (body.pass !== process.env["TOKEN_ENC_KEY"]) {
          return new Response("no", { status: 401 });
        }
        const { computeMonthlyReport } = await import("@/lib/reports/monthly-report.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        try {
          const payload = await computeMonthlyReport({
            supabase: supabaseAdmin as any,
            userId: body.userId,
            clientId: body.clientId,
            tenantId: body.tenantId,
            tenantName: "x",
            clientName: "Autotek",
            organisationName: "org",
            periodEnd: body.periodEnd,
            currency: "AUD",
          });
          return Response.json({ ok: true, payload });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? String(e) });
        }
      },
    },
  },
});
