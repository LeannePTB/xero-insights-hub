import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

/** Same saved ATO bills as Business Health; no raw invoices or live Xero reads. */
export const getLodgedTaxBills = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input) => z.object({
    tenantId: z.string().uuid(),
    widget: z.enum(["tax_obligations", "payg_withholding"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { readLodgedTaxBills } = await import("./lodged-tax.server");
    return readLodgedTaxBills(context.supabase, data.tenantId, data.widget);
  });