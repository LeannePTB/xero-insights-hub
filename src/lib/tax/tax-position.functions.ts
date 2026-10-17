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
  .inputValidator((input: unknown) => z.object({ tenantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ tax: ForwardTax | null }> => {
    const { assertWidgetAccess } = await import("@/lib/xero/access.server");
    await assertWidgetAccess(context.supabase, data.tenantId, "tax_obligations");
    const { data: clientId, error } = await context.supabase.rpc("client_for_tenant", { _tenant_id: data.tenantId });
    if (error || !clientId) throw new Error("Tax position unavailable.");
    const { loadStoredForward } = await import("./forward-tax.server");
    const { organisationToday } = await import("@/components/dashboard/tax-obligations");
    const map = await loadStoredForward(context.supabase, [{ clientId: clientId as string, tenantId: data.tenantId }], organisationToday());
    return { tax: map.get(clientId as string)?.tax ?? null };
  });
