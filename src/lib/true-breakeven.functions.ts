import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TrueBreakevenInputs = {
  loan_principal: number;
  credit_card_interest: number;
  owner_drawings: number;
  tax_payments: number | null;
  ato_payment_plan: number;
  equipment_finance: number;
  other: number;
  notes: string | null;
};

const DEFAULTS: TrueBreakevenInputs = {
  loan_principal: 0,
  credit_card_interest: 0,
  owner_drawings: 0,
  tax_payments: null,
  ato_payment_plan: 0,
  equipment_finance: 0,
  other: 0,
  notes: null,
};

export const getTrueBreakevenInputs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; tenantId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("client_true_breakeven_inputs" as any)
      .select(
        "loan_principal, credit_card_interest, owner_drawings, tax_payments, ato_payment_plan, equipment_finance, other, notes",
      )
      .eq("client_id", data.clientId)
      .eq("tenant_id", data.tenantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ...DEFAULTS };
    const r = row as any;
    return {
      loan_principal: Number(r.loan_principal) || 0,
      credit_card_interest: Number(r.credit_card_interest) || 0,
      owner_drawings: Number(r.owner_drawings) || 0,
      tax_payments:
        r.tax_payments === null || r.tax_payments === undefined
          ? null
          : Number(r.tax_payments),
      ato_payment_plan: Number(r.ato_payment_plan) || 0,
      equipment_finance: Number(r.equipment_finance) || 0,
      other: Number(r.other) || 0,
      notes: (r.notes as string) ?? null,
    } satisfies TrueBreakevenInputs;
  });

export const upsertTrueBreakevenInputs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      clientId: string;
      tenantId: string;
      inputs: Partial<TrueBreakevenInputs>;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const payload = {
      client_id: data.clientId,
      tenant_id: data.tenantId,
      ...data.inputs,
    };
    const { error } = await context.supabase
      .from("client_true_breakeven_inputs" as any)
      .upsert(payload, { onConflict: "client_id,tenant_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
