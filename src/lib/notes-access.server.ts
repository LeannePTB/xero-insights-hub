// Server-only: who may promote a client note into the monthly management report.
//
// The access rule lives in the database (public.user_can_write_client). A client
// viewer reaches a client through client_access only and is never a member of
// the organisation, so they can never mark a note for the report. A support
// grant is read-only and cannot flag a note either (security rule 5).
import { canWriteClient } from "@/lib/support-access.server";

export const NOTE_FLAG_DENIED =
  "Only organisation staff can include a note in the management report.";

export async function canManageClientNotes(userId: string, clientId: string): Promise<boolean> {
  // WRITE path: security rule 5 — a support grant is read-only, so this is
  // active membership or client ownership, resolved by
  // public.user_can_write_client.
  return canWriteClient(userId, clientId);
}

export async function assertCanManageClientNotes(userId: string, clientId: string) {
  if (!(await canManageClientNotes(userId, clientId))) throw new Error(NOTE_FLAG_DENIED);
}
