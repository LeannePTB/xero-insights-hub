// The single server function behind the internal client-list badge.
//
// One Postgres query for the whole list; zero Xero calls. Reads go through
// `context.supabase`, so the dual-check RLS on `xero_snapshots` applies as the
// caller — a staff member sees rows only for clients they are entitled to.
//
// Staff-only. Nothing here is rendered on a client-facing surface.

import { createServerFn } from "@tanstack/react-start";
import { requireAal2 } from "@/lib/auth/require-aal2";
import type { Verdict } from "./rules.server";

export type { Verdict, Finding, RuleSeverity } from "./rules.server";

export const listClientVerdicts = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((input: { firmId?: string; clientIds: string[] }) => input)
  .handler(async ({ data, context }): Promise<{ verdicts: Record<string, Verdict> }> => {
    const { computeClientVerdicts } = await import("./verdicts.server");
    return computeClientVerdicts(context.supabase, data.clientIds ?? [], data.firmId);
  });
