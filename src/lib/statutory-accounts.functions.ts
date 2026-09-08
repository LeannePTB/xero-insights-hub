// Per-client statutory account overrides: which Balance Sheet accounts hold
// GST, PAYG withholding or superannuation on this client's file.
//
// Authorisation mirrors the cost-classification write path exactly: writes go
// through `context.supabase`, so the table's own RLS
// (app_private.user_can_manage_client) is the single rule — there is no
// TypeScript-side access check to drift from it (invariant 7).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classifyTaxLine, type StatutoryCategory } from "@/lib/xero/tax-lines";

export type { StatutoryCategory };

export type StatutoryAccountRow = {
  accountId: string;
  accountName: string;
  /** What name matching alone would say: gst, payg, super, or null. */
  detected: StatutoryCategory | null;
  /** What a person has set, or null when nobody has. */
  stored: StatutoryCategory | null;
};

export const listStatutoryAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<{ rows: StatutoryAccountRow[] }> => {
    const { assertClientDataAccessForClient } = await import("@/lib/support-access.server");
    await assertClientDataAccessForClient(context.userId, data.clientId);

    const { getConnectionByTenant, xeroGet } = await import("@/lib/xero/api.server");
    const conn = await getConnectionByTenant(data.tenantId);
    const accountsRes = await xeroGet<{ Accounts?: any[] }>(conn, "Accounts");

    const { data: stored, error } = await context.supabase
      .from("client_statutory_accounts")
      .select("account_name, category")
      .eq("client_id", data.clientId)
      .eq("tenant_id", data.tenantId);
    if (error) throw new Error(error.message);

    const storedByName = new Map<string, StatutoryCategory>();
    for (const row of (stored ?? []) as any[]) {
      storedByName.set(String(row.account_name).trim().toLowerCase(), row.category);
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
        stored: storedByName.get(name.toLowerCase()) ?? null,
      });
    }
    rows.sort((x, y) => x.accountName.localeCompare(y.accountName));
    return { rows };
  });

export const setStatutoryAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      clientId: string;
      tenantId: string;
      accountName: string;
      /** null clears the override and returns the account to name matching. */
      category: StatutoryCategory | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const accountName = data.accountName.trim();
    if (!accountName) throw new Error("An account name is required.");

    if (data.category === null) {
      const { data: rows, error } = await context.supabase
        .from("client_statutory_accounts")
        .delete()
        .eq("client_id", data.clientId)
        .eq("tenant_id", data.tenantId)
        .eq("account_name", accountName)
        .select("id");
      if (error) throw new Error(error.message);
      // A delete that matches nothing is not proof of refusal, so no row count
      // is asserted here; RLS refuses the write outright when it applies.
      void rows;
    } else {
      const { data: rows, error } = await context.supabase
        .from("client_statutory_accounts")
        .upsert(
          {
            client_id: data.clientId,
            tenant_id: data.tenantId,
            account_name: accountName,
            category: data.category,
          } as any,
          { onConflict: "client_id,tenant_id,account_name" },
        )
        .select("id");
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) throw new Error("You cannot change this client.");
    }

    const { data: client } = await context.supabase
      .from("clients")
      .select("firm_id")
      .eq("id", data.clientId)
      .maybeSingle();

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      actorUserId: context.userId,
      firmId: (client as any)?.firm_id ?? null,
      action: "client_statutory_account_changed",
      targetType: "client",
      targetId: data.clientId,
      meta: {
        tenant_id: data.tenantId,
        account_name: accountName,
        category: data.category,
      },
    });
    return { ok: true };
  });
