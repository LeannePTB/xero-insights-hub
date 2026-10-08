// Rent report and rental consolidation. Reads stored nightly snapshots only
// (no live Xero calls when a page opens). Access: requireAal2, the database
// widget gate and tenant-ownership check, then every read runs as the caller
// under RLS. Writes go through audited, caller-scoped definer functions.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAal2 } from "@/lib/auth/require-aal2";
import {
  matchRentReceipts,
  rentPosition,
  type RentFrequency,
  type RentMatchType,
  type RentPosition,
} from "@/lib/rent";

const ClientTenant = z.object({
  clientId: z.string().uuid(),
  tenantId: z.string().trim().min(1).max(255),
}).strict();

const XeroId = z.string().regex(/^[A-Za-z0-9-]{1,64}$/);

const SaveInput = ClientTenant.extend({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(120),
  matchType: z.enum(["account", "tracking", "contact"]),
  matchIds: z.array(XeroId).min(1).max(20),
  expectedAmount: z.number().finite().positive().max(999_999_999.99).multipleOf(0.01),
  frequency: z.enum(["weekly", "fortnightly", "monthly"]),
  leaseStart: z.string().date().nullable(),
}).strict();

export type RentPropertyRow = {
  id: string;
  name: string;
  matchType: RentMatchType;
  matchIds: string[];
  expectedAmount: number;
  frequency: RentFrequency;
  leaseStart: string | null;
  position: RentPosition | null;
};

export type RentReport = {
  available: boolean;
  fetchedAt: string | null;
  canEdit: boolean;
  /** The consolidation group this client sits in, when the caller can see it. */
  groupId: string | null;
  properties: RentPropertyRow[];
};

function sydneyToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
}

/** Shared reader: one Xero file's properties with their rent position. */
async function buildReport(supabase: any, clientId: string, tenantId: string) {
  const { readSnapshot } = await import("@/lib/xero/snapshot-read.server");
  const { catalogueParams } = await import("@/lib/xero/snapshot-read.server");
  const [{ data: rows, error }, bank, invoices, accounts] = await Promise.all([
    supabase
      .from("client_rental_properties")
      .select("id, name, match_type, match_ids, expected_amount, frequency, lease_start")
      .eq("client_id", clientId)
      .eq("tenant_id", tenantId)
      .order("name"),
    readSnapshot({ supabase, tenantId, clientId, reportKey: "rent_bank_receipts" }),
    readSnapshot({ supabase, tenantId, clientId, reportKey: "rent_invoices_paid" }),
    readSnapshot({ supabase, tenantId, clientId, reportKey: "accounts" }),
  ]);
  if (error) throw new Error("Rental properties could not be loaded.");

  const available = !!bank && !!invoices;
  const where = String(catalogueParams("rent_bank_receipts")?.["where"] ?? "");
  const m = /DateTime\((\d+),(\d+),(\d+)\)/.exec(where);
  const windowStart = m ? `${m[1]}-${m[2]}-${m[3]}` : "1900-01-01";
  const accountIdByCode = new Map<string, string>();
  for (const a of ((accounts?.payload as any)?.Accounts ?? []) as any[]) {
    if (a?.Code && a?.AccountID) accountIdByCode.set(String(a.Code), String(a.AccountID));
  }
  const today = sydneyToday();
  const properties: RentPropertyRow[] = (rows ?? []).map((r: any) => {
    const cfg = {
      matchType: r.match_type as RentMatchType,
      matchIds: r.match_ids as string[],
      expectedAmount: Number(r.expected_amount),
      frequency: r.frequency as RentFrequency,
      leaseStart: r.lease_start as string | null,
    };
    const receipts = available
      ? matchRentReceipts(
          cfg,
          ((bank!.payload as any)?.BankTransactions ?? []) as any[],
          ((invoices!.payload as any)?.Invoices ?? []) as any[],
          accountIdByCode,
        )
      : [];
    return {
      id: r.id,
      name: r.name,
      ...cfg,
      position: available ? rentPosition(cfg, receipts, today, windowStart) : null,
    };
  });
  return {
    available,
    fetchedAt: bank?.source.fetchedAt ?? null,
    properties,
  };
}

export const getRentReport = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => ClientTenant.parse(i))
  .handler(async ({ data, context }): Promise<RentReport> => {
    const { assertWidgetAccess } = await import("@/lib/xero/access.server");
    await assertWidgetAccess(context.supabase, data.tenantId, "tax_obligations");
    const { assertTenantBelongsToClient } = await import("@/lib/tenant-ownership.server");
    await assertTenantBelongsToClient(context.supabase, data.clientId, data.tenantId);
    const [report, { data: canEdit }, { data: member }] = await Promise.all([
      buildReport(context.supabase, data.clientId, data.tenantId),
      context.supabase.rpc("can_manage_client_rental_properties", { _client_id: data.clientId }),
      context.supabase
        .from("consolidation_group_members")
        .select("group_id")
        .eq("client_id", data.clientId)
        .limit(1)
        .maybeSingle(),
    ]);
    return { ...report, canEdit: canEdit === true, groupId: (member as any)?.group_id ?? null };
  });

export type RentPickers = {
  accounts: { id: string; label: string }[];
  tracking: { id: string; label: string }[];
  contacts: { id: string; label: string }[];
};

/**
 * Choices for the property setup form. Only someone who may change the setup
 * gets them. Accounts come from the stored snapshot; tracking options and
 * contacts are one read each through the guarded Xero helper.
 */
export const getRentPickers = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => ClientTenant.parse(i))
  .handler(async ({ data, context }): Promise<RentPickers> => {
    const { data: canEdit } = await context.supabase.rpc("can_manage_client_rental_properties", {
      _client_id: data.clientId,
    });
    if (canEdit !== true) throw new Error("You can't change rental properties for this client.");
    const { assertWidgetAccess } = await import("@/lib/xero/access.server");
    await assertWidgetAccess(context.supabase, data.tenantId, "tax_obligations");
    const { assertTenantBelongsToClient } = await import("@/lib/tenant-ownership.server");
    await assertTenantBelongsToClient(context.supabase, data.clientId, data.tenantId);

    const { readSnapshot } = await import("@/lib/xero/snapshot-read.server");
    const { getConnectionByTenant, xeroGet } = await import("@/lib/xero/api.server");
    const accountsHit = await readSnapshot({
      supabase: context.supabase, tenantId: data.tenantId, clientId: data.clientId, reportKey: "accounts",
    });
    let rawAccounts = ((accountsHit?.payload as any)?.Accounts ?? []) as any[];
    const conn = await getConnectionByTenant(data.tenantId);
    if (!accountsHit) {
      rawAccounts = (await xeroGet<{ Accounts?: any[] }>(conn, "Accounts", { where: 'Class=="REVENUE"' })).Accounts ?? [];
    }
    const [tc, ct] = await Promise.all([
      xeroGet<{ TrackingCategories?: any[] }>(conn, "TrackingCategories", {}),
      xeroGet<{ Contacts?: any[] }>(conn, "Contacts", { where: "IsCustomer==true", summaryOnly: "true" }),
    ]);
    return {
      accounts: rawAccounts
        .filter((a) => a?.Class === "REVENUE" && a?.AccountID && a?.Status !== "ARCHIVED")
        .map((a) => ({ id: String(a.AccountID), label: [a.Code, a.Name].filter(Boolean).join(" — ") })),
      tracking: (tc.TrackingCategories ?? []).flatMap((c: any) =>
        (c?.Options ?? []).filter((o: any) => o?.TrackingOptionID).map((o: any) => ({
          id: String(o.TrackingOptionID),
          label: `${c.Name}: ${o.Name}`,
        })),
      ),
      contacts: (ct.Contacts ?? [])
        .filter((c: any) => c?.ContactID && c?.Name)
        .map((c: any) => ({ id: String(c.ContactID), label: String(c.Name) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
  });

export const saveRentalProperty = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => SaveInput.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("save_client_rental_property", {
      _id: data.id as any,
      _client_id: data.clientId,
      _tenant_id: data.tenantId,
      _name: data.name,
      _match_type: data.matchType,
      _match_ids: data.matchIds,
      _expected_amount: data.expectedAmount,
      _frequency: data.frequency,
      _lease_start: data.leaseStart as any,
    });
    if (error) throw new Error("The rental property could not be saved.");
    return { ok: true };
  });

export const deleteRentalProperty = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("delete_client_rental_property", { _id: data.id });
    if (error) throw new Error("The rental property could not be removed.");
    return { ok: true };
  });

export type RentConsolidationRow = RentPropertyRow & { clientName: string };
export type RentConsolidation = {
  groupName: string;
  rows: RentConsolidationRow[];
  totals: { properties: number; behind: number; arrears: number; received12Months: number; receivedThisMonth: number };
};

/**
 * Every rental property across the companies in one consolidation group. The
 * group, its members and each property are read as the caller under RLS, and
 * each Xero file passes the same widget gate as the client card; a file the
 * caller can't see is left out, never widened.
 */
export const getRentConsolidation = createServerFn({ method: "POST" })
  .middleware([requireAal2])
  .inputValidator((i: unknown) => z.object({ groupId: z.string().uuid() }).strict().parse(i))
  .handler(async ({ data, context }): Promise<RentConsolidation> => {
    const { data: group, error } = await context.supabase
      .from("consolidation_groups")
      .select("name, consolidation_group_members(client_id)")
      .eq("id", data.groupId)
      .maybeSingle();
    if (error || !group) throw new Error("That group could not be found.");
    const clientIds = ((group as any).consolidation_group_members ?? []).map((m: any) => m.client_id as string);
    if (clientIds.length === 0) {
      return { groupName: group.name, rows: [], totals: { properties: 0, behind: 0, arrears: 0, received12Months: 0, receivedThisMonth: 0 } };
    }
    const [{ data: clients }, { data: props }] = await Promise.all([
      context.supabase.from("clients").select("id, name").in("id", clientIds),
      context.supabase.from("client_rental_properties").select("client_id, tenant_id").in("client_id", clientIds),
    ]);
    const nameById = new Map((clients ?? []).map((c: any) => [c.id, c.name as string]));
    const files = new Map<string, { clientId: string; tenantId: string }>();
    for (const p of props ?? []) files.set(`${p.client_id}|${p.tenant_id}`, { clientId: p.client_id, tenantId: p.tenant_id });

    const { assertWidgetAccess } = await import("@/lib/xero/access.server");
    const rows: RentConsolidationRow[] = [];
    for (const f of files.values()) {
      try {
        await assertWidgetAccess(context.supabase, f.tenantId, "tax_obligations");
      } catch {
        continue;
      }
      const report = await buildReport(context.supabase, f.clientId, f.tenantId);
      for (const p of report.properties) rows.push({ ...p, clientName: nameById.get(f.clientId) ?? "Client" });
    }
    rows.sort((a, b) => a.clientName.localeCompare(b.clientName) || a.name.localeCompare(b.name));
    const totals = rows.reduce(
      (t, r) => ({
        properties: t.properties + 1,
        behind: t.behind + (r.position?.status === "arrears" ? 1 : 0),
        arrears: t.arrears + (r.position?.status === "ahead" ? 0 : r.position?.arrearsAmount ?? 0),
        received12Months: t.received12Months + (r.position?.received12Months ?? 0),
        receivedThisMonth: t.receivedThisMonth + (r.position?.receivedThisMonth ?? 0),
      }),
      { properties: 0, behind: 0, arrears: 0, received12Months: 0, receivedThisMonth: 0 },
    );
    return { groupName: group.name, rows, totals };
  });
