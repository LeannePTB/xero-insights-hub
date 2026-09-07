import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Read the Xero file's sales tax (GST) basis from `Organisation.SalesTaxBasis`.
 * Used as the default for the client's reporting basis and as the basis for the
 * GST Reconciliation card. The tenant is checked against the caller's access.
 */
export const getXeroSalesTaxBasis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }) => {
    const { getEffectiveTier } = await import("./access.server");
    const { normaliseSalesTaxBasis } = await import("@/lib/report-basis");
    const { isAdvisor, tier } = await getEffectiveTier(context.userId, data.tenantId);
    if (!isAdvisor && !tier) throw new Error("You don't have access to this organisation.");

    const { getConnectionByTenant, xeroGet } = await import("./api.server");
    try {
      const conn = await getConnectionByTenant(data.tenantId);
      const res = await xeroGet<{
        Organisations?: Array<{ SalesTaxBasis?: string; SalesTaxPeriod?: string }>;
      }>(conn, "Organisation");
      const raw = res.Organisations?.[0]?.SalesTaxBasis ?? null;
      const salesTaxPeriod = res.Organisations?.[0]?.SalesTaxPeriod ?? null;
      return { raw, basis: normaliseSalesTaxBasis(raw), salesTaxPeriod };
    } catch (e) {
      console.warn("[xero] sales tax basis read failed", e instanceof Error ? e.message : e);
      return { raw: null, basis: null, salesTaxPeriod: null };
    }
  });
