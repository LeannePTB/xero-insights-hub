import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";
import type { AccountRef } from "@/lib/cost-classification";

/**
 * Expense-side chart of accounts for one Xero file, used only to seed cost
 * classification defaults from Xero's account type. The tenant is verified
 * against the client server-side; the request identifiers are filters, never
 * grants.
 */
export const getExpenseAccounts = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input: { clientId: string; tenantId: string; refresh?: boolean }) => input)
  .handler(async ({ data, context }): Promise<{ accounts: AccountRef[] }> => {
    const { assertClientDataAccessForClient } = await import("@/lib/support-access.server");
    await assertClientDataAccessForClient(context.userId, data.clientId);

    // The client must actually own this Xero file (shared rule, invariant 4/7).
    const { assertTenantBelongsToClient } = await import("@/lib/tenant-ownership.server");
    await assertTenantBelongsToClient(context.supabase, data.clientId, data.tenantId);


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
    const { readAccountsFirst } = await import("./settings-accounts.server");
    const res = await readAccountsFirst(context.supabase, conn, data.clientId, !!data.refresh, xeroGet);
    const accounts: AccountRef[] = (res.Accounts ?? []).filter((a: any) => a.Class === "EXPENSE").map((a: any) => ({
      code: a.Code ?? null,
      name: a.Name as string,
      type: a.Type ?? null,
      class: a.Class ?? null,
    }));
    return { accounts };
  });
