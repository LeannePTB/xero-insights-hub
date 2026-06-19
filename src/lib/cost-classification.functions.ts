import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Classification = "fixed" | "variable" | "excluded";

export type CostClassificationRow = {
  account_name: string;
  classification: Classification;
};

export const listCostClassifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; tenantId: string }) => input)
  .handler(async ({ data, context }) => {
    const [rowsRes, clientRes] = await Promise.all([
      context.supabase
        .from("client_cost_classifications" as any)
        .select("account_name, classification")
        .eq("client_id", data.clientId)
        .eq("tenant_id", data.tenantId),
      context.supabase
        .from("clients")
        .select("cost_classification_enabled" as any)
        .eq("id", data.clientId)
        .maybeSingle(),
    ]);
    if (rowsRes.error) throw new Error(rowsRes.error.message);
    if (clientRes.error) throw new Error(clientRes.error.message);
    const enabled =
      ((clientRes.data as any)?.cost_classification_enabled ?? true) as boolean;
    return {
      rows: ((rowsRes.data ?? []) as unknown) as CostClassificationRow[],
      enabled,
    };
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

export const setCostClassificationEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; enabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clients")
      .update({ cost_classification_enabled: data.enabled } as any)
      .eq("id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
