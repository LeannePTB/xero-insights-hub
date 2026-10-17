import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";

// Saved cash flow scenarios. Reads run as the caller (RLS: client managers, or
// that client's Business Owners when shared). Every write goes through an
// audited AAL2 database function that checks the client-write rule itself.

const uuid = z.string().uuid();
const GENERIC = "This scenario could not be saved.";

export type SavedScenario = {
  id: string;
  name: string;
  payload: unknown;
  shared_with_client: boolean;
  report_period_end: string | null;
  updated_at: string;
};

export const listSavedScenarios = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ clientId: uuid }).parse(i))
  .handler(async ({ data, context }): Promise<SavedScenario[]> => {
    const { data: rows, error } = await (context.supabase as any)
      .from("client_cashflow_scenarios")
      .select("id, name, payload, shared_with_client, report_period_end, updated_at")
      .eq("client_id", data.clientId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Saved scenarios could not be read.");
    return rows ?? [];
  });

export const saveScenario = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) =>
    z.object({
      clientId: uuid,
      id: uuid.nullable(),
      name: z.string().trim().min(1).max(120),
      payload: z.record(z.string(), z.unknown()),
      reportTable: z.record(z.string(), z.unknown()).nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await (context.supabase as any).rpc("save_cashflow_scenario", {
      _client_id: data.clientId, _id: data.id, _name: data.name, _payload: data.payload, _report_table: data.reportTable,
    });
    if (error) throw new Error(GENERIC);
    return { id: id as string };
  });

export const deleteScenario = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("delete_cashflow_scenario", { _id: data.id });
    if (error) throw new Error("This scenario could not be deleted.");
    return { ok: true };
  });

export const setScenarioShared = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ id: uuid, shared: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("set_cashflow_scenario_shared", { _id: data.id, _shared: data.shared });
    if (error) throw new Error(GENERIC);
    return { ok: true };
  });

export const setScenarioReport = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ id: uuid, periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("set_cashflow_scenario_report", { _id: data.id, _period_end: data.periodEnd });
    if (error) throw new Error(GENERIC);
    return { ok: true };
  });
