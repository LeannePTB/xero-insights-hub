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
  payload: Record<string, any>;
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

/** Opening cash, known debts and tax dues for the planning tools. Reuses the
 *  shared health reader (Cash Cover's cash at bank) and the shared tax-position
 *  reader; card-gated, client resolved from the tenant server-side. */
export const getScenarioContext = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ tenantId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertWidgetAccess } = await import("@/lib/xero/access.server");
    await assertWidgetAccess(context.supabase, data.tenantId, "cashflow_scenario");
    const { data: clientId, error } = await context.supabase.rpc("client_for_tenant", { _tenant_id: data.tenantId });
    if (error || !clientId) throw new Error("Scenario details unavailable.");
    const { organisationToday } = await import("@/components/dashboard/tax-obligations");
    const today = organisationToday();
    const [{ loadHealthChecks }, { loadStoredForward }] = await Promise.all([import("@/lib/health/health-checks.server"), import("@/lib/tax/forward-tax.server")]);
    const target = [{ clientId: clientId as string, tenantId: data.tenantId }];
    const [health, forward] = await Promise.all([loadHealthChecks(context.supabase, target, today), loadStoredForward(context.supabase, target, today)]);
    const h = health.get(clientId as string);
    const tax = forward.get(clientId as string)?.tax ?? null;
    const dues: { label: string; due: string; amount: number }[] = [];
    if (tax) {
      for (const o of tax.owing) if (o.amount > 0) dues.push({ label: o.reference || "Lodged ATO bill", due: o.due, amount: o.amount });
      for (const u of tax.unlodged ?? []) if (u.amount > 0) dues.push({ label: `${u.kind === "gst" ? "GST" : "PAYG"} ${u.from.slice(0, 7)} to ${u.to.slice(0, 7)} (not lodged)`, due: u.due, amount: u.amount });
      if (tax.building.total && tax.building.total > 0) dues.push({ label: `BAS ${tax.building.from.slice(0, 7)} to ${tax.building.to.slice(0, 7)} (accruing)`, due: tax.building.due, amount: tax.building.total });
      if (tax.instalment && tax.instalment.amount > 0) dues.push({ label: "Income tax instalment", due: tax.instalment.due, amount: tax.instalment.amount });
    }
    return {
      today,
      cashAtBank: h?.cashAtBank ?? null,
      cashAsAt: h?.cashAsAt ?? null,
      knownDebts: h?.knownDebts ?? [],
      dues: dues.slice(0, 12),
      building: tax ? { amount: tax.building.total, from: tax.building.from, to: tax.building.to } : null,
    };
  });
