/**
 * Trixie usage alerting — system context only.
 *
 * Runs from the scheduled /api/public/trixie/alerts route, whose bearer check is
 * the security boundary. Reads and writes only Trixie's own usage metadata
 * (question counts, token counts, US dollar spend). No prompt, no answer and no
 * client financial figure is read, stored or emailed here.
 */
import { enqueueAppEmail } from "@/lib/email/send.server";
import { listVerifiedAuthUsers } from "@/lib/auth-users.server";

type AlertRow = { id: string; kind: string; severity: string; firm_name: string | null; title: string; detail: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Email addresses of every platform super admin. */
async function superAdminEmails(): Promise<string[]> {
  const supabase = await admin();
  const { data: roles, error } = await supabase.from("user_roles").select("user_id").eq("role", "super_admin");
  if (error) throw new Error("Could not load platform administrators.");
  const ids = new Set<string>((roles ?? []).map((r: { user_id: string }) => r.user_id));
  if (ids.size === 0) return [];
  const users = await listVerifiedAuthUsers(supabase);
  return users.filter((u) => ids.has(u.id) && u.email).map((u) => u.email as string);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Evaluates thresholds, raises new alerts and emails each one once. */
export async function runTrixieAlertCheck() {
  const supabase = await admin();
  await supabase.rpc("expire_trixie_reservations");
  const { data, error } = await supabase.rpc("evaluate_trixie_alerts");
  if (error) throw new Error("Trixie alert evaluation failed.");
  const pending: AlertRow[] = data ?? [];
  if (pending.length === 0) return { raised: 0, emailed: 0 };

  const recipients = await superAdminEmails();
  let emailed = 0;
  for (const alert of pending) {
    for (const email of recipients) {
      const sent = await enqueueAppEmail({
        templateName: "trixie-alert",
        recipientEmail: email,
        idempotencyKey: `trixie-alert-${alert.id}-${email}`,
        templateData: {
          alertTitle: alert.title,
          alertDetail: alert.detail,
          organisationName: alert.firm_name,
          severity: alert.severity,
          adminUrl: "https://www.tractionadvisory.com.au/system/trixie",
        },
      });
      if (sent.status === "queued") emailed += 1;
    }
    await supabase.rpc("mark_trixie_alert_emailed", { _id: alert.id });
  }
  return { raised: pending.length, emailed };
}

/** Monthly usage summary: spend and questions per organisation and per model. */
export async function runTrixieMonthlySummary() {
  const supabase = await admin();
  const now = new Date();
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const { data, error } = await supabase.rpc("trixie_monthly_summary", { _month: month.toISOString().slice(0, 10) });
  if (error) throw new Error("Trixie monthly summary failed.");
  const rows: Array<{ scope: string; label: string; questions: number; spend_usd: number }> = data ?? [];
  const organisations = rows.filter((r) => r.scope === "organisation").map((r) => ({ label: r.label, questions: Number(r.questions), spend: Number(r.spend_usd) })).sort((a, b) => b.spend - a.spend);
  const models = rows.filter((r) => r.scope === "model").map((r) => ({ label: r.label, questions: Number(r.questions), spend: Number(r.spend_usd) }));
  const totalSpend = organisations.reduce((sum, r) => sum + r.spend, 0);
  const totalQuestions = organisations.reduce((sum, r) => sum + r.questions, 0);

  const recipients = await superAdminEmails();
  let emailed = 0;
  for (const email of recipients) {
    const sent = await enqueueAppEmail({
      templateName: "trixie-usage-summary",
      recipientEmail: email,
      idempotencyKey: `trixie-summary-${month.toISOString().slice(0, 7)}-${email}`,
      templateData: {
        monthLabel: monthLabel(month),
        organisations,
        models,
        totalSpend,
        totalQuestions,
        adminUrl: "https://www.tractionadvisory.com.au/system/trixie",
      },
    });
    if (sent.status === "queued") emailed += 1;
  }
  return { organisations: organisations.length, emailed };
}
