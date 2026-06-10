// Server-only Xero API helpers. Never import from client/route code directly —
// only from `.functions.ts` handlers via dynamic import.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TOKEN_URL = "https://identity.xero.com/connect/token";
const API_BASE = "https://api.xero.com/api.xro/2.0";

type Connection = {
  id: string;
  user_id: string;
  tenant_id: string;
  tenant_name: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scopes: string | null;
};

function basicAuth() {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Xero is not configured (missing XERO_CLIENT_ID / XERO_CLIENT_SECRET).");
  }
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

async function refreshAccessToken(conn: Connection): Promise<Connection> {
  const res = await fetch(TOKEN_URL, {
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
    throw new Error(`Xero token refresh failed: ${res.status} ${await res.text()}`);
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
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at,
      scopes: t.scope ?? conn.scopes,
    })
    .eq("user_id", conn.user_id);
  if (error) throw new Error(`Failed to save refreshed Xero tokens: ${error.message}`);

  return { ...conn, access_token: t.access_token, refresh_token: t.refresh_token, expires_at };
}

export async function getConnection(userId: string, tenantId: string): Promise<Connection> {
  const { data, error } = await supabaseAdmin
    .from("xero_connections")
    .select("id, user_id, tenant_id, tenant_name, access_token, refresh_token, expires_at, scopes")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Xero connection not found for this organisation.");

  if (new Date(data.expires_at).getTime() - Date.now() < 60_000) {
    return await refreshAccessToken(data as Connection);
  }
  return data as Connection;
}

// Fetches a Xero connection by tenant only (no user filter). Use this when access
// has already been authorised via has_tenant_access / assertWidgetAccess.
export async function getConnectionByTenant(tenantId: string): Promise<Connection> {
  const { data, error } = await supabaseAdmin
    .from("xero_connections")
    .select("id, user_id, tenant_id, tenant_name, access_token, refresh_token, expires_at, scopes")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Xero connection not found for this organisation.");

  if (new Date(data.expires_at).getTime() - Date.now() < 60_000) {
    return await refreshAccessToken(data as Connection);
  }
  return data as Connection;
}

export async function xeroGet<T = unknown>(
  conn: Connection,
  path: string,
  params: Record<string, string | undefined> = {},
  retries = 3,
): Promise<T> {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") clean[k] = v;
  const q = new URLSearchParams(clean).toString();
  const url = `${API_BASE}/${path}${q ? "?" + q : ""}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${conn.access_token}`,
      "Xero-tenant-id": conn.tenant_id,
      Accept: "application/json",
    },
  });
  if (res.status === 429 && retries > 0) {
    const retryAfter = parseInt(res.headers.get("retry-after") || "10", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return xeroGet<T>(conn, path, params, retries - 1);
  }
  if (res.status === 401 && retries > 0) {
    const refreshed = await refreshAccessToken(conn);
    return xeroGet<T>(refreshed, path, params, retries - 1);
  }
  if (!res.ok) {
    throw new Error(`Xero ${path}: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}
