// Xero connection cleanup routine (Xero certification: apps must have a
// process that removes unused or expired connections, so App Store referral
// fees stop when a customer stops using the product, and so we never hold
// access beyond what is necessary).
//
// System context: called only from the cron route
// /api/public/xero/connection-cleanup, which authenticates with the service
// role secret. Registered in docs/security/admin-client-register.md.
//
// Xero-side listing uses the CLIENT CREDENTIALS grant with the
// `app.connections` scope — a non-tenanted token that can list and delete the
// app's connections without any user's refresh token. User tokens are never
// touched here, and a connection is removed with DELETE /connections/{id}
// (never token revocation, which would detach every organisation on the same
// Xero account).
//
// DRY-RUN FIRST: the live detach path runs only when the environment sets
// XERO_CONNECTION_CLEANUP_LIVE="true". Until then every run reports what it
// WOULD detach and changes nothing.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAudit } from "@/lib/audit.server";

const TOKEN_URL = "https://identity.xero.com/connect/token";
const CONNECTIONS_URL = "https://api.xero.com/connections";
const TIMEOUT_MS = 20_000;

type XeroConnection = {
  id: string;
  tenantId: string;
  tenantName?: string | null;
  tenantType?: string;
  createdDateUtc?: string;
  updatedDateUtc?: string;
};

export type CleanupFlag = {
  connectionId: string;
  tenantId: string;
  tenantName: string | null;
  reason:
    /** Xero lists a tenant we have no local connection row for. */
    | "unknown_tenant"
    /** Local row exists but no client is linked to it. */
    | "not_linked"
    /** Local row is already marked disconnected but Xero still lists it. */
    | "disconnected_local";
  detached: boolean;
};

export type CleanupReport = {
  dryRun: boolean;
  xeroConnections: number;
  flagged: CleanupFlag[];
};

async function appConnectionsToken(): Promise<string> {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Xero is not configured (missing XERO_CLIENT_ID / XERO_CLIENT_SECRET).");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "app.connections",
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Xero token request failed (${res.status}).`);
    const body = await res.json();
    if (!body?.access_token) throw new Error("Xero returned no access token.");
    return body.access_token as string;
  } finally {
    clearTimeout(timer);
  }
}

async function listConnections(token: string): Promise<XeroConnection[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(CONNECTIONS_URL, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Xero returned ${res.status} listing connections.`);
    const body = await res.json();
    if (!Array.isArray(body)) throw new Error("Xero returned an unexpected connection list.");
    return body as XeroConnection[];
  } finally {
    clearTimeout(timer);
  }
}

async function deleteConnection(token: string, connectionId: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${CONNECTIONS_URL}/${connectionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Xero returned ${res.status} removing a connection.`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Compare Xero's own connection list with our rows and flag connections that
 * serve no active client. Conservative by design: a connection is flagged
 * only when there is NO local row, the local row is already disconnected, or
 * no client links to it. Anything ambiguous is left alone.
 */
export async function cleanupXeroConnections(): Promise<CleanupReport> {
  const live = process.env.XERO_CONNECTION_CLEANUP_LIVE === "true";

  const token = await appConnectionsToken();
  const xeroConns = await listConnections(token);

  const [{ data: localConns, error: cErr }, { data: links, error: lErr }] = await Promise.all([
    (supabaseAdmin as any).from("xero_connections").select("id, tenant_id, status"),
    (supabaseAdmin as any).from("client_xero_orgs").select("xero_connection_id"),
  ]);
  if (cErr) throw new Error(cErr.message);
  if (lErr) throw new Error(lErr.message);

  const localByTenant = new Map<string, { id: string; status: string }>();
  for (const row of (localConns ?? []) as any[]) {
    if (row.tenant_id) localByTenant.set(row.tenant_id as string, { id: row.id, status: row.status });
  }
  const linkedConnectionIds = new Set<string>(
    ((links ?? []) as any[]).map((l) => l.xero_connection_id as string),
  );

  const flagged: CleanupFlag[] = [];
  for (const xc of xeroConns) {
    if (!xc.id || !xc.tenantId) continue;
    const local = localByTenant.get(xc.tenantId);
    let reason: CleanupFlag["reason"] | null = null;
    if (!local) reason = "unknown_tenant";
    else if (local.status === "disconnected") reason = "disconnected_local";
    else if (!linkedConnectionIds.has(local.id)) reason = "not_linked";
    if (!reason) continue;

    let detached = false;
    if (live) {
      await deleteConnection(token, xc.id);
      detached = true;
      await writeAudit({
        actorUserId: null,
        action: "xero_connection_cleanup_detach",
        targetType: "xero_connection",
        targetId: xc.tenantId,
        meta: { reason, tenantName: xc.tenantName ?? null },
      });
    }
    flagged.push({
      connectionId: xc.id,
      tenantId: xc.tenantId,
      tenantName: xc.tenantName ?? null,
      reason,
      detached,
    });
  }

  return { dryRun: !live, xeroConnections: xeroConns.length, flagged };
}
