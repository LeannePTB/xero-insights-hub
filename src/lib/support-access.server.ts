// Server-only helpers for organisation "support access".
//
// The access rule has exactly ONE implementation and it lives in the database
// (public.user_can_access_firm / public.user_can_access_client). These helpers
// are thin wrappers over those functions. Never reimplement the rule here.
//
// Membership of an organisation is enough on its own; a support grant is only
// ever needed to reach an organisation you are NOT a member of.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Membership (active) OR a live, named, unexpired support grant. Fails closed. */
export async function platformStaffCanAccessFirm(
  userId: string,
  firmId: string | null | undefined,
): Promise<boolean> {
  if (!firmId) return false;
  const { data, error } = await (supabaseAdmin as any).rpc("user_can_access_firm", {
    _user_id: userId,
    _firm_id: firmId,
  });
  if (error) return false;
  return data === true;
}

/** @deprecated thin wrapper — use platformStaffCanAccessFirm. */
export async function isFirmMember(userId: string, firmId: string): Promise<boolean> {
  return platformStaffCanAccessFirm(userId, firmId);
}

/** @deprecated thin wrapper — the rule is per-user, so a userId is required. */
export async function supportAccessActive(
  firmId: string,
  userId?: string,
): Promise<boolean> {
  if (!userId) return false;
  return platformStaffCanAccessFirm(userId, firmId);
}

export const SUPPORT_ACCESS_DENIED =
  "This organisation hasn't granted you support access to its client data.";

export async function assertClientDataAccessForFirm(userId: string, firmId: string | null) {
  if (!(await platformStaffCanAccessFirm(userId, firmId))) {
    throw new Error(SUPPORT_ACCESS_DENIED);
  }
}

/** Client-level check, resolved entirely in the database. Fails closed. */
export async function canAccessClient(userId: string, clientId: string): Promise<boolean> {
  const { data, error } = await (supabaseAdmin as any).rpc("user_can_access_client", {
    _user_id: userId,
    _client_id: clientId,
  });
  if (error) return false;
  return data === true;
}

export async function assertClientDataAccessForClient(userId: string, clientId: string) {
  if (!(await canAccessClient(userId, clientId))) {
    throw new Error(SUPPORT_ACCESS_DENIED);
  }
}
