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
  /** Every category a person has ticked. Empty when nobody has set this account. */
  stored: StatutoryCategory[];
};

/**
 * The tenant id in the request is a FILTER, never a grant (invariant 4, §10).
 * Prove the Xero file actually belongs to this client before it is used for
 * anything. Same join and same wording as `getExpenseAccounts`.
 */
async function assertTenantBelongsToClient(clientId: string, tenantId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: links, error } = await supabaseAdmin
    .from("client_xero_orgs")
    .select("xero_connections(tenant_id)")
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
  const permitted = new Set(
    ((links ?? []) as any[]).map((l) => l.xero_connections?.tenant_id).filter(Boolean) as string[],
  );
  if (!permitted.has(tenantId)) {
    throw new Error("That Xero organisation does not belong to this client.");
  }
}

export const listStatutoryAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<{ rows: StatutoryAccountRow[] }> => {
    const { assertClientDataAccessForClient } = await import("@/lib/support-access.server");
    await assertClientDataAccessForClient(context.userId, data.clientId);
    await assertTenantBelongsToClient(data.clientId, data.tenantId);

    const { getConnectionByTenant, xeroGet } = await import("@/lib/xero/api.server");
    const conn = await getConnectionByTenant(data.tenantId);
    const accountsRes = await xeroGet<{ Accounts?: any[] }>(conn, "Accounts");


    const { data: stored, error } = await context.supabase
      .from("client_statutory_accounts")
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

export const setStatutoryAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      clientId: string;
      tenantId: string;
      accountName: string;
      /** The complete set for this account. An empty array clears the override
       *  and returns the account to name matching. */
      categories: StatutoryCategory[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const accountName = data.accountName.trim();
    if (!accountName) throw new Error("An account name is required.");

    const categories = Array.from(new Set(data.categories));
    if (categories.includes("none") && categories.length > 1) {
      throw new Error("An account is either not statutory or it holds something — not both.");
    }
    if (categories.includes("super") && (categories.includes("gst") || categories.includes("payg"))) {
      throw new Error(
        "Superannuation is owed to employees' funds, not the ATO, so it cannot share an account with GST or PAYG withholding here.",
      );
    }

    // The tenant id is a filter, not a grant: no row may be keyed to a Xero
    // file this client does not own, even though RLS already confines the write
    // to clients the caller can manage.
    await assertTenantBelongsToClient(data.clientId, data.tenantId);



    // Replace the whole set for this account: delete what is there, then write
    // what was ticked. Both statements go through the caller's own session, so
    // the table's RLS is the only authorisation rule (invariant 7).
    const { error: delError } = await context.supabase
      .from("client_statutory_accounts")
      .delete()
      .eq("client_id", data.clientId)
      .eq("tenant_id", data.tenantId)
      .eq("account_name", accountName);
    if (delError) throw new Error(delError.message);

    if (categories.length > 0) {
      const { data: rows, error } = await context.supabase
        .from("client_statutory_accounts")
        .insert(
          categories.map((category) => ({
            client_id: data.clientId,
            tenant_id: data.tenantId,
            account_name: accountName,
            category,
          })) as any,
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
        categories,
      },
    });
    return { ok: true };
  });
