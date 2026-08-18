import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  .middleware([requireSupabaseAuth])
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

