import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { WidgetKey } from "@/lib/tiers";

/** Widgets/features this organisation's plan permits (plan ∩ tier config). */
export const getFirmAllowedWidgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { firmId: string }) => i)
  .handler(async ({ data, context }) => {
    const { firmAllowedWidgets } = await import("@/lib/widget-access.server");
    const widgets = await firmAllowedWidgets(context.supabase, data.firmId);
    return { widgets: widgets as WidgetKey[] };
  });

/** Widgets this client is entitled to (plan ∩ tier config, RLS-scoped). */
export const getClientAllowedWidgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    const { clientAllowedWidgets } = await import("@/lib/widget-access.server");
    const widgets = await clientAllowedWidgets(context.supabase, data.clientId);
    return { widgets: widgets as WidgetKey[] };
  });
