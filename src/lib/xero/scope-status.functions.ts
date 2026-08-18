import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type XeroScopeStatus = {
  connectionId: string;
  tenantId: string;
  tenantName: string;
  firmId: string | null;
  status: string;
  missingScopes: string[];
};

/**
 * Lists every Xero connection the caller can see (RLS decides — this reads
 * through the caller's session, never supabaseAdmin) along with the required
 * scopes that connection is missing. The missing-scope calculation lives in
 * `public.xero_missing_scopes(uuid)`; we never recompute it here.
 */
export const listXeroScopeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("xero_connections")
      .select("id, tenant_id, tenant_name, firm_id, status")
      .order("tenant_name", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const connections: XeroScopeStatus[] = await Promise.all(
      rows.map(async (row: any) => {
        let missing: string[] = [];
        const { data: result, error: rpcError } = await (context.supabase as any).rpc(
          "xero_missing_scopes",
          { _connection_id: row.id },
        );
        if (rpcError) {
          console.warn("[xero] xero_missing_scopes failed", rpcError.message);
        } else if (Array.isArray(result)) {
          missing = result as string[];
        }
        return {
          connectionId: row.id as string,
          tenantId: row.tenant_id as string,
          tenantName: (row.tenant_name as string) ?? "Unknown",
          firmId: (row.firm_id as string | null) ?? null,
          status: (row.status as string) ?? "connected",
          missingScopes: missing,
        };
      }),
    );

    return { connections };
  });
