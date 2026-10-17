import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";
import type { ForwardTax } from "@/components/dashboard/tax-obligations";

/**
 * The ONE tax position for the Tax obligations card: the same stored-only
 * forward summary Business Health, Overview, reports and Trixie read.
 * Card-gated; client resolved server-side from the tenant (a filter, never a grant).
 */
export const getStoredTaxPosition = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input: unknown) => z.object({ tenantId: z.string().uuid(), widget: z.enum(["tax_obligations", "payg_withholding"]).default("tax_obligations") }).parse(input))
  .handler(async ({ data, context }): Promise<{ tax: ForwardTax | null }> => {
    const { assertWidgetAccess } = await import("@/lib/xero/access.server");
    await assertWidgetAccess(context.supabase, data.tenantId, data.widget);
    const { data: clientId, error } = await context.supabase.rpc("client_for_tenant", { _tenant_id: data.tenantId });
    if (error || !clientId) throw new Error("Tax position unavailable.");
    const { loadStoredForward } = await import("./forward-tax.server");
    const { organisationToday } = await import("@/components/dashboard/tax-obligations");
    const map = await loadStoredForward(context.supabase, [{ clientId: clientId as string, tenantId: data.tenantId }], organisationToday());
    return { tax: map.get(clientId as string)?.tax ?? null };
  });

/** Opening cash, known debts and tax dues for the planning tools. Reuses the
 *  shared health reader (Cash Cover's cash at bank) and the shared tax-position
 *  reader; card-gated, client resolved from the tenant server-side. */
export const getScenarioContext = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ tenantId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertWidgetAccess } = await import("@/lib/xero/access.server");
    await assertWidgetAccess(context.supabase, data.tenantId, "cashflow_scenario");
    const { data: clientId, error } = await context.supabase.rpc("client_for_tenant", { _tenant_id: data.tenantId });
    if (error || !clientId) throw new Error("Scenario details unavailable.");
    const { organisationToday } = await import("@/components/dashboard/tax-obligations");
    const today = organisationToday();
    const [{ loadHealthChecks }, { loadStoredForward }] = await Promise.all([import("@/lib/health/health-checks.server"), import("@/lib/tax/forward-tax.server")]);
    const target = [{ clientId: clientId as string, tenantId: data.tenantId }];
    const [health, forward] = await Promise.all([loadHealthChecks(context.supabase, target, today), loadStoredForward(context.supabase, target, today)]);
    const h = health.get(clientId as string);
    const tax = forward.get(clientId as string)?.tax ?? null;
    const dues: { label: string; due: string; amount: number }[] = [];
    if (tax) {
      for (const o of tax.owing) if (o.amount > 0) dues.push({ label: o.reference || "Lodged ATO bill", due: o.due, amount: o.amount });
      for (const u of tax.unlodged ?? []) if (u.amount > 0) dues.push({ label: `${u.kind === "gst" ? "GST" : "PAYG"} ${u.from.slice(0, 7)} to ${u.to.slice(0, 7)} (not lodged)`, due: u.due, amount: u.amount });
      if (tax.building.total && tax.building.total > 0) dues.push({ label: `BAS ${tax.building.from.slice(0, 7)} to ${tax.building.to.slice(0, 7)} (accruing)`, due: tax.building.due, amount: tax.building.total });
      if (tax.instalment && tax.instalment.amount > 0) dues.push({ label: "Income tax instalment", due: tax.instalment.due, amount: tax.instalment.amount });
    }
    return {
      today,
      cashAtBank: h?.cashAtBank ?? null,
      cashAsAt: h?.cashAsAt ?? null,
      knownDebts: h?.knownDebts ?? [],
      dues: dues.slice(0, 12),
      building: tax ? { amount: tax.building.total, from: tax.building.from, to: tax.building.to } : null,
    };
  });
