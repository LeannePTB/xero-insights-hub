// Server-only: who may promote a client note into the monthly management report.
//
// The access rule lives in the database (public.user_can_access_firm). A client
// viewer reaches a client through client_access only and is never a member of
// the organisation, so they can never mark a note for the report.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { platformStaffCanAccessFirm } from "@/lib/support-access.server";

export const NOTE_FLAG_DENIED =
  "Only organisation staff can include a note in the management report.";

export async function canManageClientNotes(userId: string, clientId: string): Promise<boolean> {
  const { data } = await (supabaseAdmin as any)
    .from("clients")
    .select("firm_id")
    .eq("id", clientId)
    .maybeSingle();
  const firmId = (data?.firm_id as string | undefined) ?? null;
  if (!firmId) return false;
  return platformStaffCanAccessFirm(userId, firmId);
}

export async function assertCanManageClientNotes(userId: string, clientId: string) {
  if (!(await canManageClientNotes(userId, clientId))) throw new Error(NOTE_FLAG_DENIED);
}
