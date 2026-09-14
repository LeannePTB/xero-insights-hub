// Thin wrapper: server-function declaration only. Logic lives in
// report-video.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";

export const setReportVideo = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator(
    (input: {
      reportId: string;
      url?: string | null;
      heading?: string | null;
      message?: string | null;
    }) => {
      if (!input?.reportId || typeof input.reportId !== "string") {
        throw new Error("Report not found.");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { setReportVideoServer } = await import("./report-video.server");
    return setReportVideoServer({
      supabase: context.supabase,
      userId: context.userId,
      input: data,
    });
  });
