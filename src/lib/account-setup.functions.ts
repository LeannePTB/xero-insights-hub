// Account setup: the single settings screen for bank/cash, tax/super and cost
// decisions. Reads run as the caller (RLS applies); the only write is the
// AAL2, caller-scoped, audited database function save_client_account_setup.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";
import { buildSetupRows, type ChartAccount, type SetupRow, type StoredSetup } from "@/lib/account-setup";

const scope = z.object({ clientId: z.string().uuid(), tenantId: z.string().min(1).max(200) });

async function assertCanEdit(supabase: any, userId: string, clientId: string, tenantId: string) {
  const { data: ok, error } = await supabase.rpc("user_can_write_client", { _user_id: userId, _client_id: clientId });
  if (error || ok !== true) throw new Error("Account setup is available to the organisation team only.");
  const { assertTenantBelongsToClient } = await import("@/lib/tenant-ownership.server");
  await assertTenantBelongsToClient(supabase, clientId, tenantId);
}

/** Account names with posted P&L amounts in the stored YTD / prior-year / recent-month snapshots. */
function plNames(payload: any, out: Set<string>) {
  const walk = (rows: any[]) => {
    for (const r of rows ?? []) {
      if (r.RowType === "Row") {
        const name = String(r.Cells?.[0]?.Value ?? "").trim().toLowerCase();
        const has = (r.Cells ?? []).slice(1).some((c: any) => Number(String(c?.Value ?? "").replace(/,/g, "")) !== 0 && String(c?.Value ?? "") !== "");
        if (name && has) out.add(name);
      }
      if (Array.isArray(r.Rows)) walk(r.Rows);
    }
  };
  walk(payload?.Reports?.[0]?.Rows ?? payload?.Rows ?? []);
}

export const getAccountSetup = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input) => scope.extend({ refresh: z.boolean().optional() }).parse(input))
  .handler(async ({ data, context }): Promise<{ rows: SetupRow[]; chart: { id: string; name: string; code: string | null; taxEligible: boolean }[] }> => {
    await assertCanEdit(context.supabase, context.userId, data.clientId, data.tenantId);
    const { getConnectionByTenant, xeroGet } = await import("@/lib/xero/api.server");
    const conn = await getConnectionByTenant(data.tenantId);
    const { readAccountsFirst } = await import("@/lib/xero/settings-accounts.server");
    const accountsRes = await readAccountsFirst(context.supabase, conn, data.clientId, !!data.refresh, xeroGet);
    const [storedRes, plRes] = await Promise.all([
      (context.supabase as any).from("client_account_setup")
        .select("id, account_id, setup_group, value, wages_variable, account_name, match_status")
        .eq("client_id", data.clientId).eq("tenant_id", data.tenantId),
      context.supabase.from("xero_snapshots").select("payload")
        .eq("client_id", data.clientId).eq("tenant_id", data.tenantId)
        .in("report_key", ["profit_and_loss_ytd", "profit_and_loss_prior", "profit_and_loss_monthly_last3", "profit_and_loss_mtd"]),
    ]);
    if (storedRes.error) throw new Error("Saved account setup could not be read.");
    const active = new Set<string>();
    for (const s of (plRes.data ?? []) as any[]) plNames(s.payload, active);
    const accounts = ((accountsRes?.Accounts ?? []) as ChartAccount[]);
    const { canBeTaxAccount } = await import("@/lib/account-setup");
    const { logClientDataRead } = await import("@/lib/audit.server");
    logClientDataRead({ actorUserId: context.userId, clientId: data.clientId, tenantId: data.tenantId, readKey: "account_setup", source: "snapshot" });
    return {
      rows: buildSetupRows(accounts, (storedRes.data ?? []) as StoredSetup[], active),
      chart: accounts.filter(canBeTaxAccount).map((a) => ({ id: a.AccountID, name: a.Name, code: a.Code ?? null, taxEligible: true })),
    };
  });

const change = z.union([
  z.object({ accountId: z.string().uuid(), group: z.enum(["bank", "tax", "cost"]), value: z.string().max(20).nullable(), wagesVariable: z.boolean().optional() }),
  z.object({ rowId: z.string().uuid() }),
]);

export const saveAccountSetup = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input) => scope.extend({ changes: z.array(change).min(1).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const payload = data.changes.map((c) => "rowId" in c
      ? { row_id: c.rowId, value: null }
      : { account_id: c.accountId, group: c.group, value: c.value, wages_variable: !!c.wagesVariable });
    const { data: n, error } = await (context.supabase as any).rpc("save_client_account_setup", { _client_id: data.clientId, _tenant_id: data.tenantId, _changes: payload });
    if (error) throw new Error("Account setup could not be saved.");
    return { saved: Number(n ?? 0) };
  });
