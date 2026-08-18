import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The organisation's Xero files plus the scopes each one is still missing. */
export const listFirmXeroFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { firmId: string }) => input)
  .handler(async ({ data, context }) => {
    const { readFirmXeroFiles } = await import("@/lib/xero/reconnect-all.server");
    return { files: await readFirmXeroFiles(context.supabase, data.firmId) };
  });

/** One OAuth round trip that reauthorises every Xero file in the organisation. */
export const startXeroReconnectAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { firmId: string; origin: string }) => input)
  .handler(async ({ data, context }) => {
    const { startFirmReconnectAll } = await import("@/lib/xero/reconnect-all.server");
    return await startFirmReconnectAll(context.supabase, context.userId, data.firmId, data.origin);
  });
