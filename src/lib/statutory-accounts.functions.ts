// Per-client statutory account overrides: which Balance Sheet accounts hold
// GST, PAYG withholding or superannuation on this client's file.
//
// Authorisation mirrors the cost-classification write path exactly: writes go
// through `context.supabase`, so the table's own RLS
// (app_private.user_can_manage_client) is the single rule — there is no
// TypeScript-side access check to drift from it (invariant 7).
import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";
import { classifyTaxLine, type StatutoryCategory } from "@/lib/xero/tax-lines";

export type { StatutoryCategory };

export type StatutoryAccountRow = {
  accountId: string;
  accountName: string;
  /** What name matching alone would say: gst, payg, super, or null. */
  detected: StatutoryCategory | null;
  /** Every category a person has ticked. Empty when nobody has set this account. */
  stored: StatutoryCategory[];
};

/**
 * The tenant id in the request is a FILTER, never a grant (invariant 4, §10).
 * One shared implementation lives in `@/lib/tenant-ownership.server`.
 */
async function assertTenantBelongsToClient(supabase: any, clientId: string, tenantId: string) {
  const { assertTenantBelongsToClient: assertOwned } = await import(
    "@/lib/tenant-ownership.server"
  );
  await assertOwned(supabase, clientId, tenantId);
}


export const listStatutoryAccounts = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input: { clientId: string; tenantId: string; refresh?: boolean }) => input)
  .handler(async ({ data, context }): Promise<{ rows: StatutoryAccountRow[] }> => {
    const { assertClientDataAccessForClient } = await import("@/lib/support-access.server");
    await assertClientDataAccessForClient(context.userId, data.clientId);
    await assertTenantBelongsToClient(context.supabase, data.clientId, data.tenantId);

    const { getConnectionByTenant, xeroGet } = await import("@/lib/xero/api.server");
    const conn = await getConnectionByTenant(data.tenantId);
    // Stored nightly chart of accounts first (read as the caller, RLS
    // applies); live only on an explicit Refresh or when nothing is stored.
    const { readAccountsFirst } = await import("@/lib/xero/settings-accounts.server");
    const accountsRes = await readAccountsFirst(context.supabase, conn, data.clientId, !!data.refresh, xeroGet);


    const { data: stored, error } = await context.supabase
      .from("account_setup_statutory_v")
      .select("account_name, category")
      .eq("client_id", data.clientId)
      .eq("tenant_id", data.tenantId);
    if (error) throw new Error(error.message);

    // One row per account per category, so an account can be GST and PAYG
    // withholding at once.
    const storedByName = new Map<string, StatutoryCategory[]>();
    for (const row of (stored ?? []) as any[]) {
      const k = String(row.account_name).trim().toLowerCase();
      const list = storedByName.get(k) ?? [];
      if (!list.includes(row.category)) list.push(row.category);
      storedByName.set(k, list);
    }

    const rows: StatutoryAccountRow[] = [];
    for (const a of (accountsRes?.Accounts ?? []) as any[]) {
      if (String(a?.Class ?? "").toUpperCase() !== "LIABILITY") continue;
      if (String(a?.Status ?? "").toUpperCase() !== "ACTIVE") continue;
      const name = String(a?.Name ?? "").trim();
      if (!name) continue;
      // Detection is name matching only — the override is deliberately not
      // supplied here, so the panel can show detected and set side by side.
      const detected = classifyTaxLine(name, a);
      rows.push({
        accountId: String(a.AccountID),
        accountName: name,
        detected: detected === "gst" || detected === "payg" || detected === "super" ? detected : null,
        stored: storedByName.get(name.toLowerCase()) ?? [],
      });
    }
    rows.sort((x, y) => x.accountName.localeCompare(y.accountName));
    return { rows };
  });

