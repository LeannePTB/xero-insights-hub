// Thin wrapper: server-function declarations for report PDF download.
// All runtime logic lives in report-pdf.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMonthlyReportPdfUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reportId: string; regenerate?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { getReportPdfUrl } = await import("./report-pdf.server");
    return getReportPdfUrl({
      supabase: context.supabase,
      userId: context.userId,
      reportId: data.reportId,
      regenerate: !!data.regenerate,
    });
  });
