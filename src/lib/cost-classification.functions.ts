import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Classification = "fixed" | "variable";

export type CostClassificationRow = {
  account_name: string;
  classification: Classification;
};

export const listCostClassifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; tenantId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_cost_classifications" as any)
      .select("account_name, classification")
      .eq("client_id", data.clientId)
      .eq("tenant_id", data.tenantId);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as CostClassificationRow[] };
  });

export const setCostClassifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      clientId: string;
      tenantId: string;
      entries: { accountName: string; classification: Classification }[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    if (data.entries.length === 0) return { ok: true };
    const payload = data.entries.map((e) => ({
      client_id: data.clientId,
      tenant_id: data.tenantId,
      account_name: e.accountName,
      classification: e.classification,
    }));
    const { error } = await context.supabase
      .from("client_cost_classifications" as any)
      .upsert(payload, { onConflict: "client_id,tenant_id,account_name" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
