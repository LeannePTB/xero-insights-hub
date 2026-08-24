// Thin wrapper: staff-side server-function declarations for report delivery.
// All runtime logic lives in report-delivery.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const finaliseMonthlyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reportId: string }) => input)
  .handler(async ({ data, context }) => {
    const { finaliseReport } = await import("./report-delivery.server");
    return finaliseReport(context.supabase, context.userId, data.reportId);
  });

export const deleteMonthlyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reportId: string; reason?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { deleteReport } = await import("./report-delivery.server");
    return deleteReport(context.supabase, context.userId, data.reportId, data.reason ?? null);
  });

export const sendMonthlyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { reportId: string; emails: string[]; expiresInDays?: number | null }) => input,
  )
  .handler(async ({ data, context }) => {
    const { sendReport } = await import("./report-delivery.server");
    return sendReport({
      supabase: context.supabase,
      userId: context.userId,
      reportId: data.reportId,
      emails: data.emails ?? [],
      expiresInDays: data.expiresInDays ?? null,
    });
  });

export const listMonthlyReportRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reportId: string }) => input)
  .handler(async ({ data, context }) => {
    const { listRecipients } = await import("./report-delivery.server");
    return { recipients: await listRecipients(context.supabase, context.userId, data.reportId) };
  });

export const revokeMonthlyReportRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { recipientId: string }) => input)
  .handler(async ({ data, context }) => {
    const { revokeRecipient } = await import("./report-delivery.server");
    return revokeRecipient(context.supabase, context.userId, data.recipientId);
  });
