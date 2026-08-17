// Server-only helpers for organisation "support access".
//
// Platform staff (super admins / advisors) may only reach an organisation's
// client financial data when they are a member of that organisation OR the
// organisation owner has switched support access on.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function isFirmMember(userId: string, firmId: string): Promise<boolean> {
  const { data } = await (supabaseAdmin as any)
    .from("firm_members")
    .select("user_id")
    .eq("user_id", userId)
    .eq("firm_id", firmId)
    .maybeSingle();
  return !!data;
}

export async function supportAccessActive(firmId: string): Promise<boolean> {
  const { data } = await (supabaseAdmin as any)
    .from("firm_support_access")
    .select("granted")
    .eq("firm_id", firmId)
    .maybeSingle();
  return !!data?.granted;
}

/** Membership OR an active support-access grant. */
export async function platformStaffCanAccessFirm(
  userId: string,
  firmId: string | null | undefined,
): Promise<boolean> {
  if (!firmId) return false;
  if (await isFirmMember(userId, firmId)) return true;
  return supportAccessActive(firmId);
}

export const SUPPORT_ACCESS_DENIED =
  "This organisation hasn't granted support access to its client data.";

export async function assertClientDataAccessForFirm(userId: string, firmId: string | null) {
  if (!(await platformStaffCanAccessFirm(userId, firmId))) {
    throw new Error(SUPPORT_ACCESS_DENIED);
  }
}

/** Resolve the firm behind a client id, then apply the platform-staff rule. */
export async function assertClientDataAccessForClient(userId: string, clientId: string) {
  const { data } = await (supabaseAdmin as any)
    .from("clients")
    .select("firm_id")
    .eq("id", clientId)
    .maybeSingle();
  await assertClientDataAccessForFirm(userId, (data?.firm_id as string | null) ?? null);
}
