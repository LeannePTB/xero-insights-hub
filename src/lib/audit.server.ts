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
 * Phase 6 — THE one writer of a "someone read a client's figures" row.
 *
 * Every path that returns client financial data to a person calls this and
 * nothing else: live Xero calls, stored snapshots, reconciliation snapshots,
 * stored reports, report PDFs and the public report link.
 *
 * What it records: the actor, the client, the organisation, the Xero file, a
 * short stable read key, the source, and the period where one applies.
 * What it must NEVER record: figures, account names, contact names, tokens,
 * query strings, IP addresses or user agents. The trail records that a read
 * happened, never what was in it.
 *
 * Volume: a dashboard fires a dozen card reads per view, so identical
 * (actor, client, tenant, key, source) reads collapse into one row per
 * five-minute window. The key always carries the actor and the client, so a
 * read by a different person, or of a different client, is never collapsed
 * away. Writes are fire-and-forget: a read must never wait on the audit trail,
 * and a failed audit write must never break a dashboard.
 */
const READ_DEDUPE_MS = 5 * 60 * 1000;
const recentReads = new Map<string, number>();

export type ClientDataRead = {
  actorUserId?: string | null;
  clientId?: string | null;
  firmId?: string | null;
  tenantId?: string | null;
  tenantName?: string | null;
  /** Short stable key: `pnl`, `receivables`, `report:monthly`, … */
  readKey: string;
  source: import("@/lib/audit/read-keys").ReadSource;
  periodStart?: string | null;
  periodEnd?: string | null;
  reportId?: string | null;
  /** True for the public report link, which has no signed-in actor. */
  anonymous?: boolean;
};

/** Never awaited by a read path. */
export function logClientDataRead(entry: ClientDataRead): void {
  void writeClientDataRead(entry).catch((e) => console.warn("[audit] read log failed", e));
}

async function writeClientDataRead(entry: ClientDataRead): Promise<void> {
  const { READ_ACTION_REPORT, READ_ACTION_XERO } = await import("@/lib/audit/read-keys");

  let actorUserId = entry.actorUserId ?? null;
  if (!actorUserId && !entry.anonymous) {
    const { getRequestActor } = await import("@/lib/auth/request-actor.server");
    actorUserId = getRequestActor();
    // No verified actor and not the anonymous report link: this is background
    // work (cron, the daily snapshot writer). Nobody read anything.
    if (!actorUserId) return;
  }

  const dedupeKey = [
    actorUserId ?? "anonymous",
    entry.clientId ?? "",
    entry.tenantId ?? "",
    entry.readKey,
    entry.source,
    entry.periodStart ?? "",
    entry.periodEnd ?? "",
  ].join("|");
  const now = Date.now();
  const last = recentReads.get(dedupeKey);
  if (last && now - last < READ_DEDUPE_MS) return;
  recentReads.set(dedupeKey, now);
  if (recentReads.size > 5000) {
    for (const [k, t] of recentReads) if (now - t > READ_DEDUPE_MS) recentReads.delete(k);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Resolve the client and organisation when the caller only knows the Xero
  // file. This is not an access decision — the caller has already passed its
  // gate — it only fills in the audit row, and it runs at most once per
  // de-dupe window.
  let clientId = entry.clientId ?? null;
  let firmId = entry.firmId ?? null;
  if ((!clientId || !firmId) && entry.tenantId) {
    try {
      const { data } = await (supabaseAdmin as any)
        .from("client_xero_orgs")
        .select("client_id, clients!inner(firm_id), xero_connections!inner(tenant_id)")
        .eq("xero_connections.tenant_id", entry.tenantId)
        .limit(1)
        .maybeSingle();
      clientId = clientId ?? ((data as any)?.client_id ?? null);
      firmId = firmId ?? ((data as any)?.clients?.firm_id ?? null);
    } catch (e) {
      console.warn("[audit] read scope lookup failed", e);
    }
  }

  // Which access path did this reader have — membership (Path A), a support
  // grant (Path B), or client viewer? The rule lives in the database; we only
  // read it, and a failure here must not cost us the audit row.
  let accessPath: string | null = null;
  if (actorUserId && firmId) {
    try {
      const { data, error } = await (supabaseAdmin as any).rpc("firm_access_path", {
        _user_id: actorUserId,
        _firm_id: firmId,
      });
      if (!error && typeof data === "string") accessPath = data;
    } catch (e) {
      console.warn("[audit] access path lookup failed", e);
    }
  }

  const isReport = entry.source === "report" || entry.source === "report_link";
  await writeAudit({
    actorUserId,
    firmId,
    action: isReport ? READ_ACTION_REPORT : READ_ACTION_XERO,
    targetType: isReport ? "client_report" : "xero_connection",
    targetId: isReport ? (entry.reportId ?? entry.clientId ?? null) : entry.tenantId,
    meta: {
      read_key: entry.readKey,
      source: entry.source,
      client_id: clientId,
      tenant_id: entry.tenantId ?? null,
      tenant_name: entry.tenantName ?? null,
      period_start: entry.periodStart ?? null,
      period_end: entry.periodEnd ?? null,
      report_id: entry.reportId ?? null,
      anonymous: entry.anonymous === true,
      access_path: accessPath,
      deduped_window_minutes: READ_DEDUPE_MS / 60000,
    },
  });
}

/**
 * Live Xero call. Delegates to the one writer.
 *
 * The actor is the person whose request this is, taken from the verified
 * request actor. `conn.user_id` — whoever originally connected the Xero file —
 * is only the fallback for background work, and is not evidence of who read.
 */
export async function logXeroRead(
  conn: { user_id: string; tenant_id: string; tenant_name?: string | null; firm_id?: string | null },
  path: string,
): Promise<void> {
  const { readKeyForXeroPath } = await import("@/lib/audit/read-keys");
  const { getRequestActor } = await import("@/lib/auth/request-actor.server");
  logClientDataRead({
    actorUserId: getRequestActor() ?? conn.user_id,
    firmId: conn.firm_id ?? null,
    tenantId: conn.tenant_id,
    tenantName: conn.tenant_name ?? null,
    readKey: readKeyForXeroPath(path),
    source: "live",
  });
}
