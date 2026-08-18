// Server-only Xero API helpers. Never import from client/route code directly —
// only from `.functions.ts` handlers via dynamic import.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken, encryptTokenB64 } from "@/lib/crypto.server";

const TOKEN_URL = "https://identity.xero.com/connect/token";
const API_BASE = "https://api.xero.com/api.xro/2.0";
const XERO_TIMEOUT_MS = 20_000;

const MISSING_SCOPE_HINTS: Record<string, string> = {
  "Reports/BankSummary":
    "Xero needs the bank summary reports read permission. Reconnect this organisation and approve the updated read-only permissions.",
  "Reports/BalanceSheet":
    "Xero needs the balance sheet reports read permission. Reconnect this organisation and approve the updated read-only permissions.",
  "Reports/ProfitAndLoss":
    "Xero needs the profit and loss reports read permission. Reconnect this organisation and approve the updated read-only permissions.",
  Accounts:
    "Xero needs the settings read permission to list bank accounts. Reconnect this organisation and approve the updated read-only permissions.",
  Organisations:
    "Xero needs the settings read permission to read organisation details. Reconnect this organisation and approve the updated read-only permissions.",
  Invoices:
    "Xero needs the invoices read permission. Reconnect this organisation and approve the updated read-only permissions.",
  CreditNotes:
    "Xero needs the invoices read permission for credit notes. Reconnect this organisation and approve the updated read-only permissions.",
  Prepayments:
    "Xero needs the payments read permission for prepayments. Reconnect this organisation and approve the updated read-only permissions.",
  Overpayments:
    "Xero needs the payments read permission for overpayments. Reconnect this organisation and approve the updated read-only permissions.",
};

export type Connection = {
  id: string;
  user_id: string;
  tenant_id: string;
  tenant_name: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scopes: string | null;
  firm_id: string | null;
};

// Raw shape pulled from the DB — encrypted-only since plaintext columns were dropped.
type ConnectionRow = {
  id: string;
  user_id: string;
  tenant_id: string;
  tenant_name: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: string;
  scopes: string | null;
  firm_id: string | null;
};

const CONNECTION_COLUMNS =
  "id, user_id, tenant_id, tenant_name, access_token_enc, refresh_token_enc, expires_at, scopes, firm_id";

function basicAuth() {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Xero is not configured (missing XERO_CLIENT_ID / XERO_CLIENT_SECRET).");
  }
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), XERO_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Xero is taking too long to respond. Please try refreshing the card.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// Decrypt a connection row. If the encrypted columns are missing (legacy row
// written before encryption was rolled out), fall back to plaintext and
// transparently re-encrypt for next time.
// Decrypt a connection row. Plaintext columns were removed; rows missing
// encrypted tokens are unrecoverable and require reconnection.
async function materializeConnection(row: ConnectionRow): Promise<Connection> {
  if (!row.access_token_enc || !row.refresh_token_enc) {
    throw new Error("Xero connection is missing tokens. Please reconnect this organisation.");
  }
  const access = decryptToken(row.access_token_enc);
  const refresh = decryptToken(row.refresh_token_enc);

  return {
    id: row.id,
    user_id: row.user_id,
    tenant_id: row.tenant_id,
    tenant_name: row.tenant_name,
    access_token: access,
    refresh_token: refresh,
    expires_at: row.expires_at,
    scopes: row.scopes,
    firm_id: row.firm_id ?? null,
  };
}

async function refreshAccessToken(conn: Connection): Promise<Connection> {
  const res = await fetchWithTimeout(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    const { data: latest } = await supabaseAdmin
      .from("xero_connections")
      .select(CONNECTION_COLUMNS)
      .eq("user_id", conn.user_id)
      .eq("tenant_id", conn.tenant_id)
      .maybeSingle();
    if (latest) {
      const latestConn = await materializeConnection(latest as ConnectionRow);
      if (
        latestConn.refresh_token !== conn.refresh_token &&
        new Date(latestConn.expires_at).getTime() - Date.now() >= 60_000
      ) {
        return latestConn;
      }
    }
    const lower = body.toLowerCase();
    if (
      lower.includes("invalid_grant") ||
      lower.includes("invalid_client") ||
      lower.includes("unauthorized_client") ||
      res.status === 400 ||
      res.status === 401
    ) {
      console.error(`[xero] refresh failed for tenant ${conn.tenant_id}: ${res.status} ${body}`);
      // Xero issues tokens at the user level — a failed refresh invalidates
      // every linked org. Surface that to the UI via the status column.
      await supabaseAdmin
        .from("xero_connections")
        .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
        .eq("user_id", conn.user_id);
      const { writeAudit } = await import("@/lib/audit.server");
      await writeAudit({
        actorUserId: conn.user_id,
        action: "xero_reconnect_required",
        targetType: "xero_connection",
        targetId: conn.tenant_id,
        meta: { status: res.status, reason: "refresh_token_rejected" },
      });
      throw new Error(
        "Xero reconnect required: this organisation needs to be reconnected before data can load.",
      );
    }

    throw new Error(`Xero token refresh failed: ${res.status} ${body}`);
  }
  const t = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
  };
  const expires_at = new Date(Date.now() + t.expires_in * 1000).toISOString();

  // Rotate the stored tokens for every connection sharing this user (Xero issues
  // tokens at the user level, not per-tenant — refresh tokens rotate on use).
  const { error } = await supabaseAdmin
    .from("xero_connections")
    .update({
      access_token_enc: encryptTokenB64(t.access_token),
      refresh_token_enc: encryptTokenB64(t.refresh_token),
      expires_at,
      scopes: t.scope ?? conn.scopes,
      status: "connected",
      disconnected_at: null,
    })

    .eq("user_id", conn.user_id);
  if (error) throw new Error(`Failed to save refreshed Xero tokens: ${error.message}`);

  const { writeAudit } = await import("@/lib/audit.server");
  await writeAudit({
    actorUserId: conn.user_id,
    action: "xero_token_refreshed",
    targetType: "xero_connection",
    targetId: conn.tenant_id,
    meta: { expires_at, scopes: t.scope ?? conn.scopes ?? null },
  });

  return { ...conn, access_token: t.access_token, refresh_token: t.refresh_token, expires_at };

}

export async function getConnection(userId: string, tenantId: string): Promise<Connection> {
  const { data, error } = await supabaseAdmin
    .from("xero_connections")
    .select(CONNECTION_COLUMNS)
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Xero connection not found for this organisation.");

  const conn = await materializeConnection(data as ConnectionRow);
  if (new Date(conn.expires_at).getTime() - Date.now() < 60_000) {
    return await refreshAccessToken(conn);
  }
  return conn;
}

// Fetches a Xero connection by tenant only (no user filter). Use this when access
// has already been authorised via has_tenant_access / assertWidgetAccess.
export async function getConnectionByTenant(tenantId: string): Promise<Connection> {
  const { data, error } = await supabaseAdmin
    .from("xero_connections")
    .select(CONNECTION_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Xero connection not found for this organisation.");

  const conn = await materializeConnection(data as ConnectionRow);
  if (new Date(conn.expires_at).getTime() - Date.now() < 60_000) {
    return await refreshAccessToken(conn);
  }
  return conn;
}

// Which scope a given Xero path depends on. Used only to decide whether a call
// can succeed — the authoritative required-scope list lives in the database
// (`public.xero_required_scopes()` / `public.xero_missing_scopes(uuid)`).
const PATH_SCOPE: Record<string, string> = {
  "Reports/TrialBalance": "accounting.reports.trialbalance.read",
  "Reports/AgedReceivablesByContact": "accounting.reports.aged.read",
  "Reports/AgedPayablesByContact": "accounting.reports.aged.read",
  "Reports/BalanceSheet": "accounting.reports.balancesheet.read",
  "Reports/ProfitAndLoss": "accounting.reports.profitandloss.read",
  "Reports/BankSummary": "accounting.reports.banksummary.read",
  BankTransactions: "accounting.banktransactions.read",
  BankTransfers: "accounting.banktransactions.read",
  Assets: "assets.read",
};

export class XeroScopeMissingError extends Error {
  readonly scope: string;
  readonly tenantId: string;
  constructor(scope: string, tenantId: string, message: string) {
    super(message);
    this.name = "XeroScopeMissingError";
    this.scope = scope;
    this.tenantId = tenantId;
  }
}

// Small in-process cache so a dashboard render doesn't hit the RPC per widget.
const missingScopeCache = new Map<string, { at: number; scopes: string[] }>();
const MISSING_SCOPE_TTL_MS = 60_000;

/** Drop cached missing-scope results (e.g. straight after a reconnect). */
export function invalidateMissingScopes(connectionIds?: string[]) {
  if (!connectionIds?.length) {
    missingScopeCache.clear();
    return;
  }
  for (const id of connectionIds) missingScopeCache.delete(id);
}


export async function missingScopesForConnection(connectionId: string): Promise<string[]> {
  const cached = missingScopeCache.get(connectionId);
  if (cached && Date.now() - cached.at < MISSING_SCOPE_TTL_MS) return cached.scopes;
  try {
    const { data, error } = await (supabaseAdmin as any).rpc("xero_missing_scopes", {
      _connection_id: connectionId,
    });
    if (error) return [];
    const scopes = Array.isArray(data) ? (data as string[]) : [];
    missingScopeCache.set(connectionId, { at: Date.now(), scopes });
    return scopes;
  } catch {
    return [];
  }
}

export async function xeroGet<T = unknown>(
  conn: Connection,
  path: string,
  params: Record<string, string | undefined> = {},
  retries = 1,
): Promise<T> {
  // Don't fire a request we know Xero will reject for a missing scope — that
  // produced hundreds of predictable 401s and junk telemetry rows.
  const requiredScope = PATH_SCOPE[path];
  if (requiredScope && conn.id) {
    const missing = await missingScopesForConnection(conn.id);
    if (missing.includes(requiredScope)) {
      const { capabilityFor } = await import("@/lib/xero/scope-capabilities");
      throw new XeroScopeMissingError(
        requiredScope,
        conn.tenant_id,
        `Reconnect to enable this — ${conn.tenant_name} hasn't authorised ${capabilityFor(requiredScope)} yet.`,
      );
    }
  }

  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") clean[k] = v;
  const q = new URLSearchParams(clean).toString();
  const url = `${API_BASE}/${path}${q ? "?" + q : ""}`;


  const res = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${conn.access_token}`,
      "Xero-tenant-id": conn.tenant_id,
      Accept: "application/json",
    },
  });
  if (res.status === 429 && retries > 0) {
    const retryAfter = Math.min(parseInt(res.headers.get("retry-after") || "5", 10), 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return xeroGet<T>(conn, path, params, retries - 1);
  }
  if (res.status === 429) {
    throw new Error(
      "Xero has paused requests for this organisation because too many were sent. Wait about a minute, then try again.",
    );
  }
  if (res.status === 401 && retries > 0) {
    const refreshed = await refreshAccessToken(conn);
    return xeroGet<T>(refreshed, path, params, retries - 1);
  }
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401 || res.status === 403) {
      const hint = MISSING_SCOPE_HINTS[path];
      if (hint && /insufficient_scope|scope|forbidden|unauthorized/i.test(body)) {
        await logXeroApiError(conn, path, res.status, hint);
        throw new Error(hint);
      }
    }
    await logXeroApiError(conn, path, res.status, body.slice(0, 500));
    throw new Error(`Xero ${path}: ${res.status} ${body}`);
  }
  const { logXeroRead } = await import("@/lib/audit.server");
  await logXeroRead(conn, path);
  return (await res.json()) as T;

}

// Operational telemetry only — recorded in public.xero_api_errors via a
// SECURITY DEFINER RPC that aggregates by (tenant, path, status, day),
// truncates the message and prunes rows older than 30 days. audit_log stays
// reserved for access and security events.
async function logXeroApiError(
  conn: {
    id?: string;
    user_id: string;
    tenant_id: string;
    tenant_name?: string | null;
    firm_id?: string | null;
  },
  path: string,
  status: number,
  message: string,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("log_xero_api_error", {
      _firm_id: conn.firm_id ?? null,
      _connection_id: conn.id ?? null,
      _tenant_id: conn.tenant_id ?? null,
      _tenant_name: conn.tenant_name ?? null,
      _path: path,
      _status: status ?? null,
      _message: message ?? null,
    });
    if (error) console.warn("[xero] failed to record api error", error.message);
  } catch (e) {
    // Telemetry must never break the caller's request.
    console.warn("[xero] failed to record api error", e);
  }
}

