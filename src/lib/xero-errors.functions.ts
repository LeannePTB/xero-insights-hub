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
      .from("audit_log")
      .select("id, firm_id, meta, at")
      .eq("action", "xero_api_error")
      .gte("at", since)
      .order("at", { ascending: false })
      .limit(5000);
    if (data.firmId) query = query.eq("firm_id", data.firmId);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const { data: firms } = await context.supabase.from("firms").select("id, name");
    const names = new Map<string, string>((firms ?? []).map((f: any) => [f.id, f.name]));

    const groups = new Map<string, XeroErrorGroup>();
    for (const row of (rows ?? []) as any[]) {
      const meta = (row.meta ?? {}) as Record<string, unknown>;
      const path = typeof meta.path === "string" ? meta.path : "unknown";
      const status = meta.status == null ? "—" : String(meta.status);
      const firmId = (row.firm_id as string | null) ?? null;
      const key = `${firmId ?? "unattributed"}|${path}|${status}`;
      const at = row.at as string;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
        if (at < existing.firstSeen) existing.firstSeen = at;
        if (at > existing.lastSeen) {
          existing.lastSeen = at;
          existing.message = typeof meta.message === "string" ? meta.message.slice(0, 200) : null;
        }
      } else {
        groups.set(key, {
          key,
          firmId,
          organisation: firmId ? (names.get(firmId) ?? "Organisation") : "Unattributed",
          path,
          status,
          count: 1,
          firstSeen: at,
          lastSeen: at,
          message: typeof meta.message === "string" ? meta.message.slice(0, 200) : null,
        });
      }
    }

    return {
      days: data.days,
      groups: [...groups.values()].sort((a, b) => b.count - a.count),
    };
  });
