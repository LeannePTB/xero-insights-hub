import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeAudit } from "@/lib/audit.server";

function requestIp(): string | null {
  return (
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

/** Auth-lifecycle events the client is allowed to report. */
const AUTH_ACTIONS = [
  "signed_out",
  "mfa_enrolled",
  "mfa_unenrolled",
  "mfa_challenge_failed",
  "password_changed",
  "password_reset_requested",
] as const;
export type AuthAuditAction = (typeof AUTH_ACTIONS)[number];

export const logAuthEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { action: AuthAuditAction }) => {
    if (!AUTH_ACTIONS.includes(i?.action)) throw new Error("Unsupported auth event");
    return i;
  })
  .handler(async ({ data, context }) => {
    await writeAudit({
      actorUserId: context.userId,
      action: data.action,
      targetType: "auth_user",
      targetId: context.userId,
      ip: requestIp(),
      userAgent: getRequestHeader("user-agent") ?? null,
      meta: { email: (context.claims as any)?.email ?? null },
    });
    return { ok: true };
  });

/**
 * Failed sign-ins happen before a session exists, so this endpoint is
 * unauthenticated. It stores nothing the caller supplies except the attempted
 * email, and is rate limited per IP so it cannot be used to spam the trail.
 */
export const logFailedSignIn = createServerFn({ method: "POST" })
  .inputValidator((i: { email?: string; reason?: string }) => ({
    email: typeof i?.email === "string" ? i.email.slice(0, 200) : "",
    reason: typeof i?.reason === "string" ? i.reason.slice(0, 200) : "",
  }))
  .handler(async ({ data }) => {
    const ip = requestIp();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: allowed } = await (supabaseAdmin as any).rpc("check_rate_limit", {
      _key: `sign_in_failed:${ip ?? "unknown"}`,
      _max: 20,
      _window_seconds: 300,
    });
    if (allowed === false) return { ok: true };

    await writeAudit({
      action: "sign_in_failed",
      targetType: "auth_user",
      targetId: data.email || null,
      ip,
      userAgent: getRequestHeader("user-agent") ?? null,
      meta: { email: data.email || null, reason: data.reason || null },
    });
    return { ok: true };
  });

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export type AuditAnomaly = {
  id: string;
  title: string;
  detail: string;
  count: number;
  status: "ok" | "warn" | "action";
};

/** Counters an auditor (and we) watch for suspicious activity. */
export const getAuditAnomalies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const countAction = async (actions: string[], since: string) => {
      const { count } = await (supabaseAdmin as any)
        .from("audit_log")
        .select("*", { count: "exact", head: true })
        .in("action", actions)
        .gte("at", since);
      return count ?? 0;
    };

    const [failedSignIns, xeroErrors, disconnects, roleChanges, reads] = await Promise.all([
      countAction(["sign_in_failed"], since24h),
      countAction(["xero_api_error"], since24h),
      countAction(["xero_file_unlinked", "xero_disconnected", "xero_reconnect_required"], since24h),
      countAction(["role_granted", "role_revoked", "role_changed"], since7d),
      countAction(["xero_data_read"], since24h),
    ]);

    const { count: logins24h } = await (supabaseAdmin as any)
      .from("login_events")
      .select("*", { count: "exact", head: true })
      .gte("occurred_at", since24h);

    const anomalies: AuditAnomaly[] = [
      {
        id: "failed-sign-ins",
        title: "Failed sign-in attempts (24h)",
        detail: "Repeated failures from one address can indicate credential stuffing.",
        count: failedSignIns,
        status: failedSignIns >= 25 ? "action" : failedSignIns >= 10 ? "warn" : "ok",
      },
      {
        id: "successful-sign-ins",
        title: "Successful sign-ins (24h)",
        detail: "Every session start is recorded with IP and device.",
        count: logins24h ?? 0,
        status: "ok",
      },
      {
        id: "xero-errors",
        title: "Xero API errors (24h)",
        detail: "Rejected calls, expired tokens and missing permissions.",
        count: xeroErrors,
        status: xeroErrors >= 50 ? "action" : xeroErrors >= 10 ? "warn" : "ok",
      },
      {
        id: "disconnects",
        title: "Xero disconnections (24h)",
        detail: "A burst of disconnections may mean tokens were revoked or misused.",
        count: disconnects,
        status: disconnects >= 5 ? "warn" : "ok",
      },
      {
        id: "role-changes",
        title: "Permission changes (7d)",
        detail: "Grants and revocations of advisor / super admin access.",
        count: roleChanges,
        status: roleChanges >= 10 ? "warn" : "ok",
      },
      {
        id: "xero-reads",
        title: "Xero data reads logged (24h)",
        detail: "Accounting data access, grouped per user, organisation and endpoint.",
        count: reads,
        status: "ok",
      },
    ];

    return { anomalies, generatedAt: new Date().toISOString() };
  });

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Super-admin CSV export of the audit trail for auditors. */
export const exportAuditLogCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { days?: number }) => ({
    days: Math.min(Math.max(Math.trunc(i?.days ?? 90), 1), 1095),
  }))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await (supabaseAdmin as any)
      .from("audit_log")
      .select("at, action, actor_user_id, firm_id, target_type, target_id, ip, user_agent, meta")
      .gte("at", since)
      .order("at", { ascending: false })
      .limit(20000);
    if (error) throw new Error(error.message);

    const actorIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.actor_user_id).filter(Boolean)),
    );
    let emails = new Map<string, string | null>();
    if (actorIds.length) {
      const { data: profiles } = await (supabaseAdmin as any)
        .from("profiles")
        .select("id, email")
        .in("id", actorIds);
      emails = new Map((profiles ?? []).map((p: any) => [p.id, p.email]));
    }

    const header = [
      "timestamp_utc",
      "action",
      "actor_user_id",
      "actor_email",
      "firm_id",
      "target_type",
      "target_id",
      "ip",
      "user_agent",
      "meta",
    ];
    const lines = [header.join(",")];
    for (const r of rows ?? []) {
      lines.push(
        [
          r.at,
          r.action,
          r.actor_user_id,
          r.actor_user_id ? emails.get(r.actor_user_id) ?? "" : "",
          r.firm_id,
          r.target_type,
          r.target_id,
          r.ip,
          r.user_agent,
          r.meta,
        ]
          .map(csvCell)
          .join(","),
      );
    }

    await writeAudit({
      actorUserId: context.userId,
      action: "audit_log_exported",
      targetType: "audit_log",
      targetId: `${data.days}d`,
      ip: requestIp(),
      meta: { rows: rows?.length ?? 0, days: data.days },
    });

    return { csv: lines.join("\n"), rows: rows?.length ?? 0, days: data.days };
  });

/** Retention configuration + how many rows are past it. */
export const getRetentionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings } = await (supabaseAdmin as any)
      .from("security_settings")
      .select("audit_retention_days, login_retention_days")
      .eq("singleton", true)
      .maybeSingle();

    const auditDays = settings?.audit_retention_days ?? 730;
    const loginDays = settings?.login_retention_days ?? 730;
    const auditCutoff = new Date(Date.now() - auditDays * 24 * 60 * 60 * 1000).toISOString();
    const loginCutoff = new Date(Date.now() - loginDays * 24 * 60 * 60 * 1000).toISOString();

    const [{ count: staleAudit }, { count: staleLogins }, { data: lastPurge }] = await Promise.all([
      (supabaseAdmin as any)
        .from("audit_log")
        .select("*", { count: "exact", head: true })
        .lt("at", auditCutoff),
      (supabaseAdmin as any)
        .from("login_events")
        .select("*", { count: "exact", head: true })
        .lt("occurred_at", loginCutoff),
      (supabaseAdmin as any)
        .from("audit_log")
        .select("at, meta")
        .eq("action", "audit_retention_purge")
        .order("at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      auditRetentionDays: auditDays,
      loginRetentionDays: loginDays,
      staleAuditRows: staleAudit ?? 0,
      staleLoginRows: staleLogins ?? 0,
      lastPurgeAt: lastPurge?.at ?? null,
      lastPurgeMeta: lastPurge?.meta ?? null,
    };
  });
