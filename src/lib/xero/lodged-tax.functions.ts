import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";
import { lodgedAtoBills } from "@/lib/health/health-checks";

/** Same saved ATO bills as Business Health; no raw invoices or live Xero reads. */
export const getLodgedTaxBills = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input) => z.object({
    tenantId: z.string().uuid(),
    widget: z.enum(["tax_obligations", "payg_withholding"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertWidgetAccess } = await import("./access.server");
    await assertWidgetAccess(context.supabase, data.tenantId, data.widget);
    const { data: clientId, error } = await context.supabase.rpc("client_for_tenant", { _tenant_id: data.tenantId });
    if (error || !clientId) throw new Error("Unable to read tax bills.");
    const { readSnapshot } = await import("./snapshot-read.server");
    const hit = await readSnapshot({ supabase: context.supabase, tenantId: data.tenantId, clientId, reportKey: "invoices_accpay_open" });
    return { bills: lodgedAtoBills(hit?.payload), complete: hit?.source.complete === true };
  });