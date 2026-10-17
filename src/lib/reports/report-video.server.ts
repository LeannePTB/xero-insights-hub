// Caller-scoped database transactions own authorisation, audit and draft locking.
import { parseLoomId } from "./report-video";

export type SetReportVideoInput = {
  reportId: string;
  url?: string | null;
  heading?: string | null;
  message?: string | null;
};

export async function savePendingVideoServer(supabase: any, input: {
  clientId: string; periodEnd: string; reportId?: string | null;
  url?: string | null; heading?: string | null; message?: string | null;
}) {
  const url = input.url?.trim() || null;
  if (url && !parseLoomId(url)) throw new Error("Paste a valid Loom share link.");
  const { error } = await supabase.rpc("save_report_video", {
    _client_id: input.clientId, _period_end: input.periodEnd,
    _report_id: input.reportId ?? null, _url: url,
    _heading: input.heading?.trim() || null, _message: input.message?.trim() || null,
  });
  if (error) throw new Error("Message could not be saved. Check that the report is still a draft and you can manage this client.");
  return { cleared: !url && !input.heading?.trim() && !input.message?.trim() };
}

export async function setReportVideoServer(opts: { supabase: any; input: SetReportVideoInput }) {
  const { data: report, error } = await opts.supabase.from("client_reports")
    .select("client_id, period_end").eq("id", opts.input.reportId).maybeSingle();
  if (error || !report) throw new Error("Report not available.");
  return savePendingVideoServer(opts.supabase, {
    ...opts.input, clientId: report.client_id, periodEnd: report.period_end,
  });
}
