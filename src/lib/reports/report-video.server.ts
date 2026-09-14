// Server-only: set or clear the optional personal video on a DRAFT report.
//
// Invariants this file must hold (Access Control Spec §0):
//  - The report id from the request is a FILTER, never a GRANT. The firm is
//    read from the stored report row and authorised server-side.
//  - Super admin on its own grants ZERO client data (invariant 3). Setting a
//    video therefore needs BOTH the super-admin check AND the same organisation
//    write check every other report mutation uses. Neither substitutes for the
//    other.
//  - Support grants are read-only (rule 5), so the write check is
//    public.user_can_write_firm via canWriteFirm.
//  - `client_reports` has no write policy, so the write itself goes through the
//    service role, AFTER both checks pass (admin-client register).
//  - The URL never appears in audit meta.

import { VIDEO_HEADING_MAX, VIDEO_MESSAGE_MAX, parseLoomId } from "./report-video";

export type SetReportVideoInput = {
  reportId: string;
  url?: string | null;
  heading?: string | null;
  message?: string | null;
};

function clean(value: string | null | undefined, max: number): string | null {
  const s = (value ?? "").trim();
  if (!s) return null;
  return s.slice(0, max);
}

export async function setReportVideoServer(opts: {
  supabase: any;
  userId: string;
  input: SetReportVideoInput;
}) {
  const { supabase, userId, input } = opts;

  // Gate 1 — platform super admin, decided in the database.
  const { assertSuperAdminDb } = await import("@/lib/auth/super-admin.server");
  await assertSuperAdminDb(supabase);

  const { data: report, error } = await supabase
    .from("client_reports")
    .select("id, client_id, firm_id, period_end, version, status")
    .eq("id", input.reportId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!report) throw new Error("Report not found.");

  // Gate 2 — the same organisation write authorisation as every other report
  // mutation. Super admin does not stand in for this.
  const { canWriteFirm } = await import("@/lib/support-access.server");
  if (!(await canWriteFirm(userId, (report as any).firm_id))) {
    throw new Error(
      "Only organisation members may change this report. Support access is read-only.",
    );
  }

  if ((report as any).status !== "draft") {
    throw new Error(
      "This report has been finalised, so its video is locked. Generate a new version for the period if the message needs to change.",
    );
  }

  const url = clean(input.url, 500);
  const clearing = !url;
  if (url && !parseLoomId(url)) {
    throw new Error("That does not look like a Loom link. Paste a loom.com/share/… URL.");
  }

  const now = new Date().toISOString();
  const patch = clearing
    ? {
        video_url: null,
        video_heading: null,
        video_message: null,
        video_set_by: null,
        video_set_at: null,
      }
    : {
        video_url: url,
        video_heading: clean(input.heading, VIDEO_HEADING_MAX),
        video_message: clean(input.message, VIDEO_MESSAGE_MAX),
        video_set_by: userId,
        video_set_at: now,
      };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: upErr } = await (supabaseAdmin as any)
    .from("client_reports")
    .update(patch)
    .eq("id", (report as any).id)
    .eq("status", "draft");
  if (upErr) throw new Error(upErr.message);

  const { writeAudit } = await import("@/lib/audit.server");
  await writeAudit({
    actorUserId: userId,
    firmId: (report as any).firm_id,
    action: clearing ? "client_report_video_cleared" : "client_report_video_set",
    targetType: "client_reports",
    targetId: (report as any).id,
    // Deliberately no URL here — audit meta records that a video was set, not
    // where it points.
    meta: {
      client_id: (report as any).client_id,
      period_end: (report as any).period_end,
      version: (report as any).version,
    },
  });

  return { cleared: clearing, video: clearing ? null : patch };
}
