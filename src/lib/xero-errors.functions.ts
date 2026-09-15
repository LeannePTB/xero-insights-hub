import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";

/**
 * Drill-down for Xero API call failures recorded in audit_log.
 *
 * Read through the caller's own session so RLS decides what is visible:
 * organisation members see their own organisation's rows, super admins see
 * everything including rows logged before firm_id was populated. No admin
 * client, no policy changes, no writes.
 */
export type XeroErrorGroup = {
  key: string;
  firmId: string | null;
  organisation: string;
  path: string;
  status: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  message: string | null;
};

export const listXeroApiErrors = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { days?: number; firmId?: string | null }) => ({
    days: i?.days === 30 ? 30 : 7,
    firmId: typeof i?.firmId === "string" && i.firmId ? i.firmId : null,
  }))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();

    let query = context.supabase
      .from("xero_api_errors")
      .select("id, firm_id, tenant_name, path, http_status, last_message, occurrences, first_seen, last_seen, firms(name)")
      .gte("last_seen", since)
      .order("occurrences", { ascending: false });
    if (data.firmId) query = query.eq("firm_id", data.firmId);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const groups: XeroErrorGroup[] = ((rows ?? []) as any[]).map((r) => ({
      key: r.id as string,
      firmId: (r.firm_id as string | null) ?? null,
      organisation: r.firm_id ? (r.firms?.name ?? "Organisation") : "Unattributed",
      path: r.path ?? "unknown",
      status: r.http_status == null ? "—" : String(r.http_status),
      count: r.occurrences ?? 0,
      firstSeen: r.first_seen as string,
      lastSeen: r.last_seen as string,
      message: typeof r.last_message === "string" ? r.last_message : null,
    }));

    return { days: data.days, groups };
  });


export type XeroErrorBreakdownRow = {
  key: string;
  firmId: string | null;
  organisation: string;
  xeroFile: string;
  path: string;
  status: number | null;
  count: number;
  rateLimited: number;
  firstSeen: string;
  lastSeen: string;
};

/**
 * Xero API failures grouped per organisation and per Xero file, for the
 * security and monitoring section. Path C platform metadata: the database
 * function re-checks aal2 and the super-admin role itself. Telemetry only —
 * status codes and endpoint paths, never payloads, tokens or client figures.
 */
export const getXeroErrorBreakdown = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { days?: number }) => ({ days: i?.days === 30 ? 30 : 7 }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any).rpc("xero_error_breakdown", {
      _days: data.days,
    });
    if (error) throw new Error(error.message);
    const breakdown: XeroErrorBreakdownRow[] = ((rows ?? []) as any[]).map((r, i) => ({
      key: `${r.firm_id ?? "none"}-${r.tenant_name ?? "none"}-${r.path}-${r.http_status}-${i}`,
      firmId: (r.firm_id as string | null) ?? null,
      organisation: (r.firm_name as string | null) ?? "Unattributed",
      xeroFile: (r.tenant_name as string | null) ?? "Unattributed",
      path: (r.path as string) ?? "unknown",
      status: r.http_status == null ? null : Number(r.http_status),
      count: Number(r.occurrences ?? 0),
      rateLimited: Number(r.rate_limited ?? 0),
      firstSeen: r.first_seen as string,
      lastSeen: r.last_seen as string,
    }));
    return { days: data.days, breakdown };
  });
