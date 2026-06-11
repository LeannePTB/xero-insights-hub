import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCardOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("dashboard_card_order")
      .select("order")
      .eq("user_id", context.userId)
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { order: (row?.order as string[] | undefined) ?? [] };
  });

export const saveCardOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; order: string[] }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("dashboard_card_order")
      .upsert(
        {
          user_id: context.userId,
          client_id: data.clientId,
          order: data.order,
        },
        { onConflict: "user_id,client_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
