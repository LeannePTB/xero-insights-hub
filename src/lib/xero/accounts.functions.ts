import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AccountRef } from "@/lib/cost-classification";

/**
 * Expense-side chart of accounts for one Xero file, used only to seed cost
 * classification defaults from Xero's account type. The tenant is verified
 * against the client server-side; the request identifiers are filters, never
 * grants.
 */
export const getExpenseAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<{ accounts: AccountRef[] }> => {
    const { assertClientDataAccessForClient } = await import("@/lib/support-access.server");
    await assertClientDataAccessForClient(context.userId, data.clientId);

    // The client must actually own this Xero file.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: links, error: linkErr } = await supabaseAdmin
      .from("client_xero_orgs")
      .select("xero_connections(tenant_id)")
      .eq("client_id", data.clientId);
    if (linkErr) throw new Error(linkErr.message);
    const permitted = new Set(
      ((links ?? []) as any[])
        .map((l) => l.xero_connections?.tenant_id)
        .filter(Boolean) as string[],
    );
    if (!permitted.has(data.tenantId)) {
      throw new Error("That Xero organisation does not belong to this client.");
    }

    // Cost classification feeds break-even, the cash-flow scenario and the
    // wages marker in Business Health. Any one of those is enough.
    const { clientAllowedWidgets } = await import("@/lib/widget-access.server");
    const widgets = await clientAllowedWidgets(context.supabase, data.clientId);
    const consumers = ["accounting_breakeven", "true_breakeven", "cashflow_scenario", "health"];
    if (!widgets.some((w) => consumers.includes(w as string))) {
      throw new Error("Cost classification is not used by this client's dashboard.");
    }

    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    const conn = await getConnectionByTenant(data.tenantId);
    const res = await xeroGet<{ Accounts?: any[] }>(conn, "Accounts", {
      where: 'Class=="EXPENSE"',
    });
    const accounts: AccountRef[] = (res.Accounts ?? []).map((a) => ({
      code: a.Code ?? null,
      name: a.Name as string,
      type: a.Type ?? null,
      class: a.Class ?? null,
    }));
    return { accounts };
  });
