// Reconciles our xero_connections rows against what Xero itself says the
// stored token is authorised for.
//
// Why this exists: Xero issues one token per user account, and each consent
// screen replaces the previous grant. If the owner reconnects and ticks fewer
// organisations, every de-selected tenant silently starts returning 403 while
// our row still reads `status = connected` — stale figures, no signal. Nothing
// else in the app ever asks Xero what it thinks is connected.
//
// Read-only against Xero (GET /connections). Never writes to Xero, never
// deletes a row, never touches tokens beyond the app's own refresh path.
//
// Section 10: tenant ids are resolved server-side from our own rows and from
// Xero's response — never from a caller.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getConnection } from "./api.server";
import { writeAudit } from "@/lib/audit.server";

const CONNECTIONS_URL = "https://api.xero.com/connections";
const TIMEOUT_MS = 20_000;

/** Only rows carrying this reason may be restored by this check. */
export const NOT_AUTHORISED_REASON = "not_authorised";

type Row = {
  id: string;
  user_id: string;
  tenant_id: string;
  tenant_name: string | null;
  firm_id: string | null;
  status: string | null;
  disconnected_reason: string | null;
};

export type AuthorisationReconcileSummary = {
  usersChecked: number;
  usersSkipped: number;
  authorisedTenants: number;
  markedDisconnected: number;
  restored: number;
};

async function fetchAuthorisedTenantIds(accessToken: string): Promise<string[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(CONNECTIONS_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: controller.signal,
    });
    // Fail closed on the DATA, not on the status: any non-OK response (429,
    // 5xx, network error) returns null and the caller leaves every row alone.
    if (!res.ok) {
      console.warn(`[xero] /connections returned ${res.status}; leaving statuses untouched`);
      return null;
    }
    const body = (await res.json()) as Array<{ tenantId?: string; tenantType?: string }>;
    if (!Array.isArray(body) || body.length === 0) {
      // An empty list would disconnect everything at once. Treat it as
      // unusable rather than authoritative.
      console.warn("[xero] /connections returned an empty list; leaving statuses untouched");
      return null;
    }
    return body
      .filter((t) => !t.tenantType || t.tenantType === "ORGANISATION")
      .map((t) => t.tenantId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch (e) {
    console.warn("[xero] /connections failed", e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One /connections call per Xero user account (one token covers every tenant
 * on it), never one per connection. Safe to call repeatedly; it only writes
 * when a row's authorisation actually changed.
 */
export async function reconcileAuthorisedTenants(
  /** Optional filter: only these Xero user accounts. Logic is unchanged. */
  userIds?: string[],
): Promise<AuthorisationReconcileSummary> {
  const summary: AuthorisationReconcileSummary = {
    usersChecked: 0,
    usersSkipped: 0,
    authorisedTenants: 0,
    markedDisconnected: 0,
    restored: 0,
  };

  const { data, error } = await (supabaseAdmin as any)
    .from("xero_connections")
    .select("id, user_id, tenant_id, tenant_name, firm_id, status, disconnected_reason");
  if (error) {
    console.warn("[xero] authorisation reconcile: could not read connections", error.message);
    return summary;
  }

  const rows = (data ?? []) as Row[];
  const only = userIds && userIds.length > 0 ? new Set(userIds) : null;
  const byUser = new Map<string, Row[]>();
  for (const row of rows) {
    if (!row.user_id || !row.tenant_id) continue;
    if (only && !only.has(row.user_id)) continue;
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  for (const [userId, userRows] of byUser) {
    // Probe with a row that still holds usable tokens; getConnection goes
    // through the app's own refresh path, so any rotated refresh token is
    // persisted exactly as normal.
    const probe = userRows.find((r) => r.status === "connected") ?? userRows[0];
    let authorised: string[] | null = null;
    try {
      const conn = await getConnection(userId, probe.tenant_id);
      authorised = await fetchAuthorisedTenantIds(conn.access_token);
    } catch (e) {
      console.warn(
        "[xero] authorisation reconcile: token unavailable for a user",
        e instanceof Error ? e.message : e,
      );
      authorised = null;
    }

    if (!authorised) {
      summary.usersSkipped += 1;
      continue;
    }

    summary.usersChecked += 1;
    summary.authorisedTenants += authorised.length;
    const allowed = new Set(authorised);

    for (const row of userRows) {
      const isAuthorised = allowed.has(row.tenant_id);

      if (!isAuthorised && row.status !== "disconnected") {
        const { error: updErr } = await (supabaseAdmin as any)
          .from("xero_connections")
          .update({
            status: "disconnected",
            disconnected_at: new Date().toISOString(),
            disconnected_reason: NOT_AUTHORISED_REASON,
          })
          .eq("id", row.id);
        if (updErr) {
          console.warn("[xero] could not mark connection disconnected", updErr.message);
          continue;
        }
        summary.markedDisconnected += 1;
        await writeAudit({
          actorUserId: null,
          firmId: row.firm_id,
          action: "xero_authorisation_lost",
          targetType: "xero_connection",
          targetId: row.tenant_id,
          meta: {
            tenant_name: row.tenant_name,
            reason: NOT_AUTHORISED_REASON,
            source: "connections_reconcile",
          },
        });
        continue;
      }

      // Only ever revive what THIS check disconnected. A row disconnected for
      // any other cause (rejected refresh token, admin cleanup, or a row that
      // predates the reason column and so carries NULL) is left alone.
      if (
        isAuthorised &&
        row.status === "disconnected" &&
        row.disconnected_reason === NOT_AUTHORISED_REASON
      ) {
        const { error: updErr } = await (supabaseAdmin as any)
          .from("xero_connections")
          .update({ status: "connected", disconnected_at: null, disconnected_reason: null })
          .eq("id", row.id)
          .eq("disconnected_reason", NOT_AUTHORISED_REASON);
        if (updErr) {
          console.warn("[xero] could not restore connection", updErr.message);
          continue;
        }
        summary.restored += 1;
        await writeAudit({
          actorUserId: null,
          firmId: row.firm_id,
          action: "xero_authorisation_restored",
          targetType: "xero_connection",
          targetId: row.tenant_id,
          meta: { tenant_name: row.tenant_name, source: "connections_reconcile" },
        });
      }
    }
  }

  return summary;
}
