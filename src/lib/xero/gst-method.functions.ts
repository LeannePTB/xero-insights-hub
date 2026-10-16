import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

const readInput = z.object({ clientId: z.string().uuid() }).strict();
const saveInput = z.object({ clientId: z.string().uuid(), method: z.enum(["xero", "cash", "accrual"]) }).strict();

/** The client's GST accounting-method override, read under the caller's own
 *  session (clients RLS decides visibility). `canEdit` is presentation only;
 *  the write is enforced by set_client_gst_method. */
export const getClientGstMethod = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => readInput.parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: row, error } = await sb.from("clients").select("basis_overrides").eq("id", data.clientId).maybeSingle();
    if (error || !row) throw new Error("GST setting is unavailable.");
    const v = (row.basis_overrides as Record<string, unknown> | null)?.gst_method;
    const { data: canEdit } = await sb.rpc("can_manage_client_income_tax_instalments", { _client_id: data.clientId });
    return { method: v === "cash" || v === "accrual" ? v : ("xero" as const), canEdit: canEdit === true };
  });

/** Audited AAL2 change; organisation team only (database-enforced). */
export const setClientGstMethod = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => saveInput.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("set_client_gst_method", { _client_id: data.clientId, _method: data.method });
    if (error) throw new Error(error.code === "42501" ? "You can't change this setting." : "GST setting could not be saved.");
    return { ok: true };
  });
