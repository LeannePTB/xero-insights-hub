/**
 * Client setup checklist server functions.
 *
 * Reads: aal2 plus the same client-data check every other client read uses.
 * Writes: the acknowledgement goes to `clients.setup_ack` through
 * `context.supabase`, so the `clients` write policies decide — a support grant
 * is read-only and cannot record one (invariant 5, backlog 32).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";
import { SETUP_ITEMS, type SetupChecklist, type SetupItemKey } from "@/lib/setup-checklist.server";

export type { SetupChecklist, SetupItemKey };

export const getClientSetupChecklist = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }): Promise<SetupChecklist> => {
    const { assertClientDataAccessForClient } = await import("@/lib/support-access.server");
    await assertClientDataAccessForClient(context.userId, data.clientId);
    const { setupChecklist } = await import("@/lib/setup-checklist.server");
    return setupChecklist(context.supabase, data.clientId);
  });

/**
 * Record a deliberate answer, or withdraw one. Only the checklist's own item
 * keys are accepted, and nothing else in `setup_ack` is touched.
 */
export const acknowledgeSetupItem = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: { clientId: string; item: SetupItemKey; choice: string; undo?: boolean }) => {
    if (!(SETUP_ITEMS as readonly string[]).includes(i.item))
      throw new Error("Unknown setup item.");
    if (typeof i.choice !== "string" || i.choice.length > 64) throw new Error("Invalid choice.");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { assertClientDataAccessForClient } = await import("@/lib/support-access.server");
    await assertClientDataAccessForClient(context.userId, data.clientId);

    const { data: row, error: readErr } = await context.supabase
      .from("clients")
      .select("setup_ack")
      .eq("id", data.clientId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);

    const ack = { ...(((row as any)?.setup_ack ?? {}) as Record<string, unknown>) };
    if (data.undo) delete ack[data.item];
    else
      ack[data.item] = {
        at: new Date().toISOString(),
        by: context.userId,
        choice: data.choice,
      };

    const { data: updated, error } = await context.supabase
      .from("clients")
      .update({ setup_ack: ack } as any)
      .eq("id", data.clientId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!updated || updated.length === 0) throw new Error("You cannot change this client.");

    const { setupChecklist } = await import("@/lib/setup-checklist.server");
    return setupChecklist(context.supabase, data.clientId);
  });
