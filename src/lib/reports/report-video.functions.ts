import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";
import { VIDEO_HEADING_MAX, VIDEO_MESSAGE_MAX } from "./report-video";

const videoFields = {
  url: z.string().max(500).nullable().optional(),
  heading: z.string().max(VIDEO_HEADING_MAX).nullable().optional(),
  message: z.string().max(VIDEO_MESSAGE_MAX).nullable().optional(),
};
const periodFields = { clientId: z.string().uuid(), periodEnd: z.string().date() };

export const setReportVideo = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input) => z.object({ reportId: z.string().uuid(), ...videoFields }).parse(input))
  .handler(async ({ data, context }) => {
    const { setReportVideoServer } = await import("./report-video.server");
    return setReportVideoServer({ supabase: context.supabase, input: data });
  });

export const getPendingReportVideo = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input) => z.object(periodFields).parse(input))
  .handler(async ({ data, context }) => {
    const { data: video, error } = await context.supabase.rpc("get_pending_report_video", {
      _client_id: data.clientId, _period_end: data.periodEnd,
    });
    if (error) throw new Error("Report video could not be loaded.");
    return { video };
  });

export const savePendingReportVideo = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input) => z.object({ ...periodFields, ...videoFields, reportId: z.string().uuid().nullable().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { savePendingVideoServer } = await import("./report-video.server");
    return savePendingVideoServer(context.supabase, data);
  });
