import { lodgedAtoBills } from "@/lib/health/health-checks";
import { assertWidgetAccess } from "./access.server";
import { readSnapshot } from "./snapshot-read.server";

export async function readLodgedTaxBills(supabase: any, tenantId: string, widget: "tax_obligations" | "payg_withholding") {
  await assertWidgetAccess(supabase, tenantId, widget);
  const { data: clientId, error } = await supabase.rpc("client_for_tenant", { _tenant_id: tenantId });
  if (error || !clientId) throw new Error("Unable to read tax bills.");
  const hit = await readSnapshot({ supabase, tenantId, clientId, reportKey: "invoices_accpay_open" });
  return { bills: lodgedAtoBills(hit?.payload), complete: hit?.source.complete === true };
}