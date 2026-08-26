// The single server function behind the internal client-list badge.
//
// One Postgres query for the whole list; zero Xero calls. Reads go through
// `context.supabase`, so the dual-check RLS on `xero_snapshots` applies as the
// caller — a staff member sees rows only for clients they are entitled to.
//
// Staff-only. Nothing here is rendered on a client-facing surface.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Verdict } from "./rules.server";

export type { Verdict, Finding, RuleSeverity } from "./rules.server";

export const listClientVerdicts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { firmId?: string; clientIds: string[] }) => input)
  .handler(async ({ data, context }): Promise<{ verdicts: Record<string, Verdict> }> => {
    const clientIds = Array.from(new Set(data.clientIds ?? [])).slice(0, 500);
    if (!clientIds.length) return { verdicts: {} };

    const { REQUIRED_REPORT_KEYS } = await import("./rule-thresholds");
    const { evaluateClient } = await import("./rules.server");

    // One query. With `firmId` supplied this uses xero_snapshots_firm_report_idx
    // on (firm_id, report_key).
    let q = context.supabase
      .from("xero_snapshots")
      .select("client_id, tenant_id, report_key, payload, payload_version, as_at, fetched_at, complete")
      .in("report_key", REQUIRED_REPORT_KEYS as unknown as string[])
      .in("client_id", clientIds);
    if (data.firmId) q = q.eq("firm_id", data.firmId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Connection status per client, so a disconnected Xero file never renders
    // as a green verdict.
    const { data: linkRows } = await context.supabase
      .from("client_xero_orgs")
      .select("client_id, xero_connections(tenant_id, status)")
      .in("client_id", clientIds);

    const connections = new Map<string, { tenantId: string; status: string }[]>();
    for (const link of (linkRows ?? []) as any[]) {
      const conn = link.xero_connections;
      if (!conn) continue;
      const list = connections.get(link.client_id) ?? [];
      list.push({ tenantId: conn.tenant_id, status: conn.status });
      connections.set(link.client_id, list);
    }

    const snapshots = new Map<string, any[]>();
    for (const row of (rows ?? []) as any[]) {
      const list = snapshots.get(row.client_id) ?? [];
      list.push(row);
      snapshots.set(row.client_id, list);
    }

    const now = new Date();
    const verdicts: Record<string, Verdict> = {};
    for (const clientId of clientIds) {
      // A client the caller can list but whose snapshots RLS withholds is
      // rendered as unavailable, never silently omitted and never green.
      if (!connections.has(clientId) && !snapshots.has(clientId)) {
        verdicts[clientId] = {
          state: "unavailable",
          label: "Unavailable",
          detail: "No snapshot data is readable for this client with your access.",
          findings: [],
        };
        continue;
      }
      verdicts[clientId] = evaluateClient({
        clientId,
        connections: connections.get(clientId) ?? [],
        snapshots: snapshots.get(clientId) ?? [],
        now,
      });
    }

    return { verdicts };
  });
