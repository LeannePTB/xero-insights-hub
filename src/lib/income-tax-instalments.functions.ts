import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

const clientTenantSchema = z.object({
  clientId: z.string().uuid(),
  tenantId: z.string().trim().min(1).max(255),
});

const saveSchema = clientTenantSchema.extend({
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  amount: z.number().finite().min(0).max(999_999_999_999.99).multipleOf(0.01),
}).refine((value) => value.periodEnd >= value.periodStart, {
  message: "The period end must be on or after the period start.",
  path: ["periodEnd"],
});

export type IncomeTaxInstalment = {
  id: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  updatedAt: string;
};

export const listIncomeTaxInstalments = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input: unknown) => clientTenantSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ instalments: IncomeTaxInstalment[]; canEdit: boolean }> => {
    const { assertTenantBelongsToClient } = await import("@/lib/tenant-ownership.server");
    await assertTenantBelongsToClient(context.supabase, data.clientId, data.tenantId);

    const [{ data: rows, error }, { data: canEdit, error: permissionError }] = await Promise.all([
      context.supabase
        .from("client_income_tax_instalments")
        .select("id, period_start, period_end, amount, updated_at")
        .eq("client_id", data.clientId)
        .eq("tenant_id", data.tenantId)
        .order("period_end", { ascending: false }),
      context.supabase.rpc("can_manage_client_income_tax_instalments", {
        _client_id: data.clientId,
      }),
    ]);
    if (error) throw new Error(error.message);
    if (permissionError) throw new Error(permissionError.message);

    return {
      canEdit: canEdit === true,
      instalments: (rows ?? []).map((row) => ({
        id: row.id,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        amount: Number(row.amount),
        updatedAt: row.updated_at,
      })),
    };
  });

export const saveIncomeTaxInstalment = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await context.supabase.rpc(
      "save_client_income_tax_instalment",
      {
        _client_id: data.clientId,
        _tenant_id: data.tenantId,
        _period_start: data.periodStart,
        _period_end: data.periodEnd,
        _amount: data.amount,
      },
    );
    if (error) throw new Error(error.message);
    if (!saved) throw new Error("The income tax instalment could not be saved.");
    return { ok: true };
  });
