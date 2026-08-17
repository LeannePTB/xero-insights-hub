/**
 * Centralised audit-log writer.
 *
 * Every security-relevant event (auth lifecycle, Xero token lifecycle, Xero
 * data reads, admin actions) funnels through here so the audit trail meets the
 * Xero API Consumer security standard: who did what, to which record, when,
 * and from where.
 *
 * Writes are best-effort — a failed audit insert must never break the user's
 * request. Failures are logged to the server console for investigation.
 */

export type AuditEntry = {
  actorUserId?: string | null;
  firmId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
};

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("audit_log").insert({
      actor_user_id: entry.actorUserId ?? null,
      firm_id: entry.firmId ?? null,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      ip: entry.ip ?? null,
      user_agent: entry.userAgent ?? null,
      meta: entry.meta ?? {},
    });
    if (error) console.warn("[audit] insert failed", entry.action, error.message);
  } catch (e) {
    console.warn("[audit] insert threw", entry.action, e);
  }
}

/**
 * Xero data reads happen dozens of times per dashboard load. Logging every one
 * would flood the trail, so identical (user, tenant, endpoint) reads collapse
 * into a single entry per window.
 */
const READ_DEDUPE_MS = 5 * 60 * 1000;
const recentReads = new Map<string, number>();

export async function logXeroRead(
  conn: { user_id: string; tenant_id: string; tenant_name?: string | null },
  path: string,
): Promise<void> {
  const key = `${conn.user_id}|${conn.tenant_id}|${path}`;
  const now = Date.now();
  const last = recentReads.get(key);
  if (last && now - last < READ_DEDUPE_MS) return;
  recentReads.set(key, now);

  if (recentReads.size > 2000) {
    for (const [k, t] of recentReads) if (now - t > READ_DEDUPE_MS) recentReads.delete(k);
  }

  await writeAudit({
    actorUserId: conn.user_id,
    action: "xero_data_read",
    targetType: "xero_connection",
    targetId: conn.tenant_id,
    meta: {
      endpoint: path,
      tenant_name: conn.tenant_name ?? null,
      deduped_window_minutes: READ_DEDUPE_MS / 60000,
    },
  });
}
