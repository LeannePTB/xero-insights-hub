export type PayrollSetting = "registered" | "not_registered" | "setting_required";

/**
 * Resolve the client's explicit PAYG setting through the caller's existing
 * database access. The tenant and client ids are both filters: the joined row
 * must exist before payroll may be queried.
 */
export async function payrollSettingForClient(
  supabase: any,
  tenantId: string,
  clientId?: string | null,
): Promise<PayrollSetting> {
  if (!clientId) return "setting_required";
  const { data, error } = await supabase
    .from("client_xero_orgs")
    .select("client_id, clients!inner(payg_withholding_cycle), xero_connections!inner(tenant_id)")
    .eq("client_id", clientId)
    .eq("xero_connections.tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This Xero organisation is not linked to that client.");
  const cycle = (data as any).clients?.payg_withholding_cycle ?? null;
  if (cycle === "not_registered") return "not_registered";
  return cycle == null ? "setting_required" : "registered";
}