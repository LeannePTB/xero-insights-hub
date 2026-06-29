// Server-only Xero API helpers. Never import from client/route code directly —
// only from `.functions.ts` handlers via dynamic import.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken, encryptTokenB64 } from "@/lib/crypto.server";

const TOKEN_URL = "https://identity.xero.com/connect/token";
const API_BASE = "https://api.xero.com/api.xro/2.0";
const XERO_TIMEOUT_MS = 20_000;

const MISSING_SCOPE_HINTS: Record<string, string> = {
  "Reports/ActivityStatement": "Xero needs the tax reports read permission for Activity Statement data. Reconnect this organisation and approve the updated read-only permissions.",
  "Reports/BankSummary": "Xero needs the bank summary reports read permission. Reconnect this organisation and approve the updated read-only permissions.",
  "Reports/BalanceSheet": "Xero needs the balance sheet reports read permission. Reconnect this organisation and approve the updated read-only permissions.",
  "Reports/ProfitAndLoss": "Xero needs the profit and loss reports read permission. Reconnect this organisation and approve the updated read-only permissions.",
  "Accounts": "Xero needs the settings read permission to list bank accounts. Reconnect this organisation and approve the updated read-only permissions.",
  "Organisations": "Xero needs the settings read permission to read organisation details. Reconnect this organisation and approve the updated read-only permissions.",
  "Invoices": "Xero needs the invoices read permission. Reconnect this organisation and approve the updated read-only permissions.",
  "CreditNotes": "Xero needs the invoices read permission for credit notes. Reconnect this organisation and approve the updated read-only permissions.",
  "Prepayments": "Xero needs the payments read permission for prepayments. Reconnect this organisation and approve the updated read-only permissions.",
  "Overpayments": "Xero needs the payments read permission for overpayments. Reconnect this organisation and approve the updated read-only permissions.",
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
};

// Raw shape pulled from the DB, with both legacy plaintext and AES-256-GCM columns.
type ConnectionRow = {
  id: string;
  user_id: string;
  tenant_id: string;
  tenant_name: string;
  access_token: string | null;
  refresh_token: string | null;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: string;
  scopes: string | null;
};

const CONNECTION_COLUMNS =
  "id, user_id, tenant_id, tenant_name, access_token, refresh_token, access_token_enc, refresh_token_enc, expires_at, scopes";

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
async function materializeConnection(row: ConnectionRow): Promise<Connection> {
  let access = "";
  let refresh = "";
  let needsBackfill = false;

  if (row.access_token_enc) {
    access = decryptToken(row.access_token_enc);
  } else if (row.access_token) {
    access = row.access_token;
    needsBackfill = true;
  }
  if (row.refresh_token_enc) {
    refresh = decryptToken(row.refresh_token_enc);
  } else if (row.refresh_token) {
    refresh = row.refresh_token;
    needsBackfill = true;
  }

  if (!access || !refresh) {
    throw new Error("Xero connection is missing tokens. Please reconnect this organisation.");
  }

  if (needsBackfill) {
    await supabaseAdmin
      .from("xero_connections")
      .update({
        access_token_enc: encryptTokenB64(access),
        refresh_token_enc: encryptTokenB64(refresh),
        access_token: null,
        refresh_token: null,
      })
      .eq("id", row.id);
  }

  return {
    id: row.id,
    user_id: row.user_id,
    tenant_id: row.tenant_id,
    tenant_name: row.tenant_name,
    access_token: access,
    refresh_token: refresh,
    expires_at: row.expires_at,
    scopes: row.scopes,
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
    if (lower.includes("invalid_grant") || lower.includes("invalid_client") || lower.includes("unauthorized_client") || res.status === 400 || res.status === 401) {
      console.error(`[xero] refresh failed for tenant ${conn.tenant_id}: ${res.status} ${body}`);
      // Xero issues tokens at the user level — a failed refresh invalidates
      // every linked org. Surface that to the UI via the status column.
      await supabaseAdmin
        .from("xero_connections")
        .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
        .eq("user_id", conn.user_id);
      throw new Error("Xero reconnect required: this organisation needs to be reconnected before data can load.");
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
      access_token: null,
      refresh_token: null,
      expires_at,
      scopes: t.scope ?? conn.scopes,
      status: "connected",
      disconnected_at: null,
    })
    .eq("user_id", conn.user_id);
  if (error) throw new Error(`Failed to save refreshed Xero tokens: ${error.message}`);

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
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Xero connection not found for this organisation.");

  const conn = await materializeConnection(data as ConnectionRow);
  if (new Date(conn.expires_at).getTime() - Date.now() < 60_000) {
    return await refreshAccessToken(conn);
  }
  return conn;
}

export async function xeroGet<T = unknown>(
  conn: Connection,
  path: string,
  params: Record<string, string | undefined> = {},
  retries = 1,
): Promise<T> {
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
    throw new Error("Xero has paused requests for this organisation because too many were sent. Wait about a minute, then try again.");
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
  return (await res.json()) as T;
}

async function logXeroApiError(
  conn: { user_id: string; tenant_id: string; tenant_name?: string | null },
  path: string,
  status: number,
  message: string,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: conn.user_id,
      action: "xero_api_error",
      target_type: "xero_connection",
      target_id: conn.tenant_id,
      meta: { path, status, message, tenant_name: conn.tenant_name ?? null },
    });
  } catch (e) {
    console.warn("[xero] failed to write api error to audit_log", e);
  }
}
