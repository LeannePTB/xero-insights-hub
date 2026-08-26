// Client-callable wrapper for the read-time file capability profile.
//
// Thin by design: module scope holds only imports and the exported server
// function. Everything runtime lives in `./file-capability.server`.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FileCapability } from "./file-capability.server";

export type { FileCapability, CapabilityTri } from "./file-capability.server";

export const getFileCapability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; clientId?: string }) => input)
  .handler(async ({ data, context }): Promise<FileCapability> => {
    const { getEffectiveTier } = await import("./access.server");
    const { isAdvisor, tier } = await getEffectiveTier(context.userId, data.tenantId);
    if (!isAdvisor && !tier) throw new Error("You don't have access to this organisation.");

    const { resolveFileCapability } = await import("./file-capability.server");
    return resolveFileCapability({
      supabase: context.supabase,
      tenantId: data.tenantId,
      clientId: data.clientId ?? null,
    });
  });
