// Thin wrapper: server-function declarations only. All runtime logic lives in
// monthly-report.server.ts / monthly-report-context.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateMonthlyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; periodEnd: string; tenantId?: string | null }) => input)
  .handler(async ({ data, context }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.periodEnd)) throw new Error("Choose a period end.");
    const { resolveReportContext, saveDraftReport } = await import("./monthly-report-context.server");
    const { computeMonthlyReport } = await import("./monthly-report.server");
    const { MONTHLY_REPORT_PAYLOAD_VERSION, monthLabel } = await import("./monthly-report");

    const ctx = await resolveReportContext({
      supabase: context.supabase,
      userId: context.userId,
      clientId: data.clientId,
      preferTenantId: data.tenantId ?? null,
    });

    const payload = await computeMonthlyReport({
      supabase: context.supabase,
      userId: context.userId,
      clientId: ctx.clientId,
      tenantId: ctx.tenantId,
      tenantName: ctx.tenantName,
      clientName: ctx.clientName,
      organisationName: ctx.organisationName,
      periodEnd: data.periodEnd,
      currency: ctx.currency,
    });

    const title = `Monthly Management Report — ${ctx.clientName} — ${monthLabel(data.periodEnd)}`;
    const saved = await saveDraftReport({
      ctx,
      userId: context.userId,
      periodEnd: data.periodEnd,
      payload,
      payloadVersion: MONTHLY_REPORT_PAYLOAD_VERSION,
      title,
    });

    return { id: saved.id, version: saved.version, status: "draft" as const, title, payload };
  });

export const listMonthlyReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    const { listReportsForClient } = await import("./monthly-report-context.server");
    return { reports: await listReportsForClient(context.supabase, data.clientId) };
  });

/** Opens a stored report. Returns the STORED payload — never a fresh computation. */
export const getStoredMonthlyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reportId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("client_reports")
      .select("id, client_id, period_end, version, status, title, complete, payload, payload_version, generated_at")
      .eq("id", data.reportId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Report not found.");
    return { report: row as any };
  });
