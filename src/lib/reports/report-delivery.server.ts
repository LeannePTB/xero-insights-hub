// Server-only: finalise, delete, email and recipient-bound access for monthly
// management reports.
//
// Invariants this file must hold (Access Control Spec §0):
//  - The report id / token from the request is a FILTER, never a GRANT. Staff
//    actions are authorised through public.user_can_access_client +
//    platformStaffCanAccessFirm; recipient access is authorised solely by a
//    token hash lookup that resolves the one report the token was issued for.
//  - Deletion goes through public.delete_client_report — never a direct DELETE.
//  - The raw recipient token is generated, put in the email link, and dropped.
//    Only its SHA-256 hash is stored, and it is never logged.
//  - A recipient token reaches exactly one report. It never reaches the client
//    dashboard, another period, another report, or any Xero data.

import { createHash, randomBytes } from "crypto";

const DEFAULT_EXPIRY_DAYS = 30;
const MAX_EXPIRY_DAYS = 180;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("hex");
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Staff-side guard: the caller may manage this report's client. */
async function authoriseStaffForReport(supabase: any, userId: string, reportId: string) {
  const { data: report, error } = await supabase
    .from("client_reports")
    .select("id, client_id, firm_id, period_end, version, status, title, sent_at, pdf_path")
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!report) throw new Error("Report not found.");

  const { assertClientDataAccessForClient, platformStaffCanAccessFirm } = await import(
    "@/lib/support-access.server"
  );
  await assertClientDataAccessForClient(userId, report.client_id);
  if (!(await platformStaffCanAccessFirm(userId, report.firm_id))) {
    throw new Error("Only organisation members may manage this report.");
  }
  return report as {
    id: string;
    client_id: string;
    firm_id: string;
    period_end: string;
    version: number;
    status: string;
    title: string | null;
    sent_at: string | null;
    pdf_path: string | null;
  };
}

/** Live recipients (not revoked) for a report. */
export async function listRecipients(supabase: any, userId: string, reportId: string) {
  await authoriseStaffForReport(supabase, userId, reportId);
  const { data, error } = await supabase
    .from("report_recipients")
    .select(
      "id, email, sent_at, expires_at, revoked_at, first_opened_at, last_opened_at, open_count",
    )
    .eq("report_id", reportId)
    .order("sent_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function finaliseReport(supabase: any, userId: string, reportId: string) {
  const report = await authoriseStaffForReport(supabase, userId, reportId);
  if (report.status !== "draft") {
    throw new Error("Only a draft can be finalised.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin as any)
    .from("client_reports")
    .update({ status: "final", finalised_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("status", "draft");
  if (error) throw new Error(error.message);

  // A finalised PDF is rendered exactly once, here, from the stored payload.
  // Any earlier draft render carried a DRAFT watermark and is superseded.
  const { ensureFinalReportPdf } = await import("./report-pdf.server");
  await ensureFinalReportPdf(reportId);

  const { writeAudit } = await import("@/lib/audit.server");
  await writeAudit({
    actorUserId: userId,
    firmId: report.firm_id,
    action: "client_report_finalised",
    targetType: "client_reports",
    targetId: reportId,
    meta: { client_id: report.client_id, period_end: report.period_end, version: report.version },
  });
  return { status: "final" as const };
}

/**
 * Delete via public.delete_client_report. The function authorises the caller
 * itself, permits drafts freely, requires a super admin for final/sent, revokes
 * every recipient link and writes its own audit row.
 */
export async function deleteReport(
  supabase: any,
  _userId: string,
  reportId: string,
  reason: string | null,
) {
  const { data, error } = await supabase.rpc("delete_client_report", {
    _report_id: reportId,
    _reason: reason,
  });
  if (error) {
    const msg = error.message ?? "Could not delete this report.";
    if (/REPORT_IS_(FINAL|SENT)/i.test(msg)) {
      throw new Error(
        "This report has been finalised or sent, so only a super admin can delete it.",
      );
    }
    if (/NO_ACCESS/i.test(msg)) throw new Error("You cannot delete this report.");
    if (/NOT_FOUND/i.test(msg)) throw new Error("Report not found.");
    throw new Error(msg);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    deleted: !!row?.deleted,
    recipientsRevoked: Number(row?.recipients_revoked ?? 0),
  };
}

export async function revokeRecipient(supabase: any, userId: string, recipientId: string) {
  const { data: rec, error } = await supabase
    .from("report_recipients")
    .select("id, report_id, client_id, email, revoked_at")
    .eq("id", recipientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!rec) throw new Error("Recipient link not found.");

  const report = await authoriseStaffForReport(supabase, userId, rec.report_id);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: upErr } = await (supabaseAdmin as any)
    .from("report_recipients")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", recipientId)
    .is("revoked_at", null);
  if (upErr) throw new Error(upErr.message);

  const { writeAudit } = await import("@/lib/audit.server");
  await writeAudit({
    actorUserId: userId,
    firmId: report.firm_id,
    action: "client_report_link_revoked",
    targetType: "report_recipients",
    targetId: recipientId,
    meta: { report_id: rec.report_id, client_id: rec.client_id, email: rec.email },
  });
  return { revoked: true };
}

function siteOrigin(): string {
  const explicit = process.env["SITE_URL"] || process.env["VITE_SITE_URL"];
  if (explicit) return explicit.replace(/\/+$/, "");
  return "https://tractionadvisory.com.au";
}

/**
 * Email a finalised report. One random token per recipient; only its hash is
 * stored. The raw token exists in the link and nowhere else.
 */
export async function sendReport(opts: {
  supabase: any;
  userId: string;
  reportId: string;
  emails: string[];
  expiresInDays?: number | null;
}) {
  const report = await authoriseStaffForReport(opts.supabase, opts.userId, opts.reportId);
  if (report.status === "draft") {
    throw new Error("Finalise the report before sending it. A draft cannot be sent.");
  }

  const emails = Array.from(new Set(opts.emails.map(normaliseEmail).filter(Boolean)));
  if (!emails.length) throw new Error("Add at least one email address.");
  if (emails.length > 20) throw new Error("Send to at most 20 recipients at a time.");
  const bad = emails.filter((e) => !isEmail(e));
  if (bad.length) throw new Error(`That does not look like an email address: ${bad[0]}`);

  const days = Math.min(
    MAX_EXPIRY_DAYS,
    Math.max(1, Math.round(Number(opts.expiresInDays ?? DEFAULT_EXPIRY_DAYS) || DEFAULT_EXPIRY_DAYS)),
  );
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const sentAt = new Date().toISOString();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { writeAudit } = await import("@/lib/audit.server");
  const { enqueueAppEmail } = await import("@/lib/email/send.server");

  const { data: client } = await (supabaseAdmin as any)
    .from("clients")
    .select("name")
    .eq("id", report.client_id)
    .maybeSingle();

  const origin = siteOrigin();
  const results: { email: string; status: string }[] = [];

  for (const email of emails) {
    const token = newToken();
    const { data: inserted, error: insErr } = await (supabaseAdmin as any)
      .from("report_recipients")
      .insert({
        report_id: report.id,
        client_id: report.client_id,
        email,
        token_hash: hashToken(token),
        sent_by: opts.userId,
        sent_at: sentAt,
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (insErr) {
      results.push({ email, status: "failed" });
      continue;
    }

    const link = `${origin}/report/${token}`;
    const send = await enqueueAppEmail({
      templateName: "report-ready",
      recipientEmail: email,
      idempotencyKey: `report-${report.id}-${inserted.id}`,
      templateData: {
        reportUrl: link,
        reportTitle: report.title ?? "Monthly management report",
        clientName: (client as any)?.name ?? "your business",
        recipientEmail: email,
        expiresInDays: days,
      },
    });
    results.push({ email, status: send.status });

    await writeAudit({
      actorUserId: opts.userId,
      firmId: report.firm_id,
      action: "client_report_sent",
      targetType: "report_recipients",
      targetId: inserted.id,
      meta: {
        report_id: report.id,
        client_id: report.client_id,
        period_end: report.period_end,
        version: report.version,
        email,
        expires_at: expiresAt,
        delivery: send.status,
      },
    });
  }

  const previouslySent: string[] = [];
  const { data: allSent } = await (supabaseAdmin as any)
    .from("report_recipients")
    .select("email")
    .eq("report_id", report.id);
  for (const r of (allSent ?? []) as any[]) {
    if (!previouslySent.includes(r.email)) previouslySent.push(r.email);
  }

  await (supabaseAdmin as any)
    .from("client_reports")
    .update({ status: "sent", sent_at: sentAt, sent_to: previouslySent })
    .eq("id", report.id);

  return { sent: results, expiresAt };
}

// ---------------------------------------------------------------------------
// Recipient-bound access
// ---------------------------------------------------------------------------

const INVALID = "This link is no longer valid.";

type Recipient = {
  id: string;
  report_id: string;
  client_id: string;
  email: string;
  expires_at: string;
  revoked_at: string | null;
  open_count: number;
  first_opened_at: string | null;
};

/**
 * Resolve a raw token to a live recipient row. Every failure mode — unknown
 * token, revoked, expired, deleted parent report — returns the SAME generic
 * error, so the endpoint never tells an attacker which condition failed.
 * `revoked_at` is re-read here on EVERY call; the decision is never cached.
 */
async function resolveToken(token: string): Promise<{ recipient: Recipient; report: any }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rec } = await (supabaseAdmin as any)
    .from("report_recipients")
    .select("id, report_id, client_id, email, expires_at, revoked_at, open_count, first_opened_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!rec) throw new Error(INVALID);
  if (rec.revoked_at) throw new Error(INVALID);
  if (new Date(rec.expires_at).getTime() <= Date.now()) throw new Error(INVALID);

  const { data: report } = await (supabaseAdmin as any)
    .from("client_reports")
    .select("id, client_id, firm_id, title, period_end, version, status, payload, pdf_path")
    .eq("id", rec.report_id)
    .maybeSingle();
  // Deleting a report revokes its links, but check anyway: the token must never
  // outlive the one report it was issued for.
  if (!report || report.client_id !== rec.client_id) throw new Error(INVALID);

  return { recipient: rec as Recipient, report };
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  const head = user.slice(0, 1);
  return `${head}${"•".repeat(Math.max(2, user.length - 1))}@${domain}`;
}

/** Step 1: does this link exist, and which address must be confirmed? */
export async function describeLink(token: string, ip: string | null) {
  const { enforceRateLimit } = await import("@/lib/rate-limit.server");
  await enforceRateLimit(`report_link_lookup:${ip ?? "unknown"}`, 30, 300);

  const { recipient, report } = await resolveToken(token);
  return {
    reportTitle: report.title ?? "Monthly management report",
    periodEnd: report.period_end as string,
    emailHint: maskEmail(recipient.email),
  };
}

/**
 * Step 2: the recipient confirms the address the link was sent to. A bare link
 * is only as private as the inbox it landed in — a forwarded link will not open
 * for whoever it was forwarded to unless they also know the address.
 */
export async function openLink(token: string, email: string, ip: string | null, ua: string | null) {
  const { enforceRateLimit } = await import("@/lib/rate-limit.server");
  await enforceRateLimit(`report_link_open:${ip ?? "unknown"}`, 10, 300);
  await enforceRateLimit(`report_link_token:${hashToken(token).slice(0, 32)}`, 10, 300);

  const { recipient, report } = await resolveToken(token);
  if (normaliseEmail(email) !== recipient.email) {
    throw new Error("That email address does not match this link.");
  }

  const now = new Date().toISOString();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any)
    .from("report_recipients")
    .update({
      first_opened_at: recipient.first_opened_at ?? now,
      last_opened_at: now,
      open_count: Number(recipient.open_count ?? 0) + 1,
    })
    .eq("id", recipient.id);

  const { writeAudit } = await import("@/lib/audit.server");
  await writeAudit({
    actorUserId: null,
    firmId: report.firm_id,
    action: "client_report_link_opened",
    targetType: "report_recipients",
    targetId: recipient.id,
    ip,
    userAgent: ua,
    meta: {
      report_id: report.id,
      client_id: report.client_id,
      period_end: report.period_end,
      email: recipient.email,
    },
  });

  // The PDF, when one exists, is served through a short-lived signed URL minted
  // AFTER the token and address are verified. The bucket stays private.
  let pdfUrl: string | null = null;
  if (report.pdf_path) {
    const { data: signed } = await (supabaseAdmin as any).storage
      .from("client-reports")
      .createSignedUrl(report.pdf_path, 300);
    pdfUrl = signed?.signedUrl ?? null;
    if (pdfUrl) {
      await writeAudit({
        actorUserId: null,
        firmId: report.firm_id,
        action: "client_report_pdf_downloaded",
        targetType: "client_reports",
        targetId: report.id,
        ip,
        userAgent: ua,
        meta: {
          client_id: report.client_id,
          period_end: report.period_end,
          version: report.version,
          status: report.status,
          pdf_path: report.pdf_path,
          email: recipient.email,
          via: "recipient_link",
        },
      });
    }
  }

  return {
    report: {
      title: report.title ?? "Monthly management report",
      periodEnd: report.period_end as string,
      version: report.version as number,
      status: report.status as string,
      payload: report.payload,
    },
    pdfUrl,
  };
}
