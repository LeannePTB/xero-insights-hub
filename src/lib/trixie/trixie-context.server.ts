import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TrixieRouteHint = { pathname: string; clientId: string | null; firmId: string | null; tenantId: string | null };
export type TrixieContext = {
  supabase: ReturnType<typeof createClient<Database>>;
  reservationId: string;
  mode: "platform" | "organisation" | "client" | "general";
  audience: "platform" | "staff" | "viewer";
  firmId: string | null;
  clientId: string | null;
  tenantId: string | null;
  model: string;
  allowance: number | null;
  warningThreshold: number;
  used: number;
  route: TrixieRouteHint;
};

export function parseTrixieRoute(pathname: unknown): TrixieRouteHint {
  const clean = typeof pathname === "string" && pathname.startsWith("/") && pathname.length <= 500 ? pathname.split(/[?#]/)[0] : "/";
  const client = /^\/clients\/([0-9a-f-]{36})(?:\/|$)/i.exec(clean);
  const firm = /^\/firms\/([0-9a-f-]{36})(?:\/|$)/i.exec(clean);
  const tenant = /^\/clients\/[0-9a-f-]{36}\/(?:payables|receivables|audit)\/([^/]+)$/i.exec(clean);
  return {
    pathname: clean,
    clientId: client && UUID.test(client[1]) ? client[1] : null,
    firmId: firm && UUID.test(firm[1]) ? firm[1] : null,
    tenantId: tenant ? decodeURIComponent(tenant[1]).slice(0, 255) : null,
  };
}

function callerClient(token: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Trixie backend configuration is unavailable.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function resolveTrixieContext(request: Request, pathname: unknown): Promise<TrixieContext> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw Object.assign(new Error("Sign in to use Trixie."), { status: 401 });
  const supabase = callerClient(token);
  const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || claims?.claims?.aal !== "aal2") throw Object.assign(new Error("Complete two-factor verification to use Trixie."), { status: 401 });
  const route = parseTrixieRoute(pathname);
  const system = route.pathname === "/system" || route.pathname.startsWith("/system/");
  const { data, error } = await (supabase as any).rpc("reserve_trixie_usage", {
    _client_id: system ? null : route.clientId,
    _firm_id: system ? null : route.firmId,
    _system: system,
  });
  if (error) {
    const limit = /TRIXIE_LIMIT_REACHED/.test(error.message);
    throw Object.assign(new Error(limit ? "This month’s Trixie allowance has been used." : error.message), { status: limit ? 429 : 403 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.reservation_id) throw Object.assign(new Error("Trixie is unavailable for this page."), { status: 403 });
  let tenantId = route.tenantId;
  if (tenantId && route.clientId) {
    const { data: resolved, error: tenantError } = await (supabase as any).rpc("client_for_tenant", { _tenant_id: tenantId });
    if (tenantError || resolved !== route.clientId) tenantId = null;
  }
  return {
    supabase,
    reservationId: row.reservation_id,
    mode: row.mode,
    audience: row.audience,
    firmId: row.firm_id ?? null,
    clientId: row.client_id ?? null,
    tenantId,
    model: row.model,
    allowance: row.monthly_allowance ?? null,
    warningThreshold: row.warning_threshold,
    used: row.used,
    route,
  };
}