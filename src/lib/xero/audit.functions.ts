import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server functions for the Xero file audit. All gated to advisor / super_admin
// via has_role; tenant access is checked through getConnectionByTenant.

async function assertAdvisor(supabase: any, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["advisor", "super_admin"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden: advisor only");
}

export const runXeroAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tenantId: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { tenantId } = data;
    const { getConnectionByTenant, xeroGet } = await import("@/lib/xero/api.server");
    const { ruleCoaHygiene, ruleArAp, ruleBank, rulePayments } = await import("@/lib/xero/audit/rules.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const conn = await getConnectionByTenant(tenantId);
    const started = Date.now();
    let summary: any = {};
    let runError: string | null = null;

    // Insert run row first so the page can show "running"; we'll update with summary.
    const { data: run, error: runErr } = await (supabaseAdmin as any)
      .from("audit_runs")
      .insert({ tenant_id: tenantId, run_by: context.userId, summary: {} })
      .select("id")
      .single();
    if (runErr) throw new Error(runErr.message);
    const runId = run.id as string;

    try {
      // Payments lookback: last 12 months
      const since = new Date(Date.now() - 365 * 86_400_000).toISOString();
      // Fetch in parallel. Org gives us shortCode for deep links.
      const [orgRes, accountsRes, invoicesRes, creditNotesRes, paymentsRes] = await Promise.all([
        xeroGet<any>(conn, "Organisations").catch(() => null),
        xeroGet<any>(conn, "Accounts"),
        // Pull all unpaid + paid in last 24m to bound size.
        xeroGet<any>(conn, "Invoices", { Statuses: "AUTHORISED,SUBMITTED,DRAFT", page: "1" }),
        xeroGet<any>(conn, "CreditNotes", { Statuses: "AUTHORISED,SUBMITTED" }).catch(() => ({ CreditNotes: [] })),
        xeroGet<any>(conn, "Payments", { where: `Status=="AUTHORISED"&&Date>=DateTime(${since.slice(0, 10).replace(/-/g, ",")})` }).catch(() => ({ Payments: [] })),
      ]);

      const shortCode: string | null = orgRes?.Organisations?.[0]?.ShortCode ?? null;
      const accounts = (accountsRes?.Accounts ?? []) as any[];
      const invoices = (invoicesRes?.Invoices ?? []) as any[];
      const creditNotes = (creditNotesRes?.CreditNotes ?? []) as any[];
      const payments = (paymentsRes?.Payments ?? []) as any[];

      const findings = [
        ...ruleCoaHygiene(accounts, shortCode),
        ...ruleBank(accounts, shortCode),
        ...ruleArAp(invoices, creditNotes, shortCode),
        ...rulePayments(payments, shortCode),
      ];

      // Persist findings.
      if (findings.length > 0) {
        const rows = findings.map((f) => ({
          run_id: runId,
          tenant_id: tenantId,
          rule_id: f.ruleId,
          category: f.category,
          severity: f.severity,
          title: f.title,
          message: f.message,
          entity_type: f.entityType,
          entity_id: f.entityId,
          deep_link: f.deepLink,
          evidence: f.evidence,
          finding_key: f.findingKey,
        }));
        // chunk inserts to avoid hitting payload limits
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500);
          const { error } = await (supabaseAdmin as any).from("audit_findings").insert(chunk);
          if (error) throw new Error(error.message);
        }
      }

      const bySev = { high: 0, medium: 0, low: 0 } as Record<string, number>;
      const byCat: Record<string, number> = {};
      for (const f of findings) {
        bySev[f.severity] = (bySev[f.severity] ?? 0) + 1;
        byCat[f.category] = (byCat[f.category] ?? 0) + 1;
      }
      summary = { total: findings.length, severity: bySev, category: byCat, accounts: accounts.length, invoices: invoices.length, payments: payments.length };
    } catch (e: any) {
      runError = e?.message ?? String(e);
    }

    await (supabaseAdmin as any)
      .from("audit_runs")
      .update({ summary, duration_ms: Date.now() - started, error: runError })
      .eq("id", runId);

    return { runId, summary, error: runError };
  });

export const getLatestAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tenantId: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { getConnectionByTenant } = await import("@/lib/xero/api.server");
    await getConnectionByTenant(data.tenantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: run } = await (supabaseAdmin as any)
      .from("audit_runs")
      .select("id, run_at, run_by, summary, duration_ms, error")
      .eq("tenant_id", data.tenantId)
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!run) return { run: null, findings: [], snoozes: {} };

    const [{ data: findings }, { data: snoozes }] = await Promise.all([
      (supabaseAdmin as any).from("audit_findings").select("*").eq("run_id", run.id).order("severity"),
      (supabaseAdmin as any).from("audit_finding_snoozes").select("finding_key, snoozed_until, note").eq("tenant_id", data.tenantId),
    ]);
    const snoozeMap: Record<string, { until: string | null; note: string | null }> = {};
    for (const s of snoozes ?? []) {
      snoozeMap[s.finding_key] = { until: s.snoozed_until, note: s.note };
    }
    return { run, findings: findings ?? [], snoozes: snoozeMap };
  });

export const snoozeFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      tenantId: z.string().min(1),
      findingKey: z.string().min(1),
      days: z.number().int().nullable(), // null = indefinite
      note: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { getConnectionByTenant } = await import("@/lib/xero/api.server");
    await getConnectionByTenant(data.tenantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const until = data.days ? new Date(Date.now() + data.days * 86_400_000).toISOString() : null;
    const { error } = await (supabaseAdmin as any)
      .from("audit_finding_snoozes")
      .upsert({
        tenant_id: data.tenantId,
        finding_key: data.findingKey,
        snoozed_until: until,
        snoozed_by: context.userId,
        note: data.note ?? null,
      }, { onConflict: "tenant_id,finding_key" });
    if (error) throw new Error(error.message);
    return { ok: true, until };
  });

export const unsnoozeFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tenantId: z.string().min(1), findingKey: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("audit_finding_snoozes")
      .delete()
      .eq("tenant_id", data.tenantId)
      .eq("finding_key", data.findingKey);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
