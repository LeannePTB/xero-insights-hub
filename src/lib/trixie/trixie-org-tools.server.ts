import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { TrixieContext } from "./trixie-context.server";
import { deepToolsFor } from "./trixie-tool-policy";
import { UNTRUSTED_NOTE, untrusted } from "./trixie-deep-logic";
import { overdueSummary, ownBusinessClient, resolveClientName, type AccessibleClient } from "./trixie-org-logic";

// Organisation-level Trixie tools (staff only, organisation or general workspace).
//  - The client list is the caller-scoped Overview list (overview_clients, via
//    buildOverview as the caller). Names typed by the model are matched ONLY
//    against that list; the model never passes an id.
//  - A named client is then re-verified in the database (trixie_access_context
//    as the caller) and its Xero files loaded through the caller's own session,
//    exactly as when the client page is opened. Card tools re-check card gates.
//  - Receivables per client re-check assert_widget_access for every file.

type Source = { label: string; asAt: string | null; href?: string };
export type ClientReaders = Record<string, (ctx: TrixieContext) => Promise<unknown>>;

async function overviewRows(ctx: TrixieContext) {
  const { buildOverview } = await import("@/lib/overview/overview.server");
  // Organisation page: that organisation is a filter only. General: every
  // client the caller's Overview already lists. Never a "first organisation".
  const ov = await buildOverview(ctx.supabase as any, ctx.userId, ctx.mode === "organisation" ? ctx.firmId : null);
  return ctx.mode === "organisation" ? ov.rows.filter((r) => r.firmId === ctx.firmId) : ov.rows;
}

async function accessibleClients(ctx: TrixieContext): Promise<AccessibleClient[]> {
  const rows = await overviewRows(ctx);
  return rows.map((r) => ({ clientId: r.clientId, clientName: r.clientName, firmId: r.firmId, firmName: r.firmName }));
}

async function tenantsFor(ctx: TrixieContext, clientId: string) {
  const { data } = await (ctx.supabase as any)
    .from("client_xero_orgs")
    .select("xero_connections!inner(tenant_id, tenant_name)")
    .eq("client_id", clientId);
  return (data ?? [])
    .map((l: any) => ({ tenantId: l.xero_connections?.tenant_id, name: l.xero_connections?.tenant_name || "Xero file" }))
    .filter((t: any): t is { tenantId: string; name: string } => typeof t.tenantId === "string" && t.tenantId.length > 0 && t.tenantId.length <= 255);
}

/** A client-scoped context, verified by the database as the caller. Null when not allowed. */
export async function scopeToClient(ctx: TrixieContext, clientId: string): Promise<TrixieContext | null> {
  const { data, error } = await (ctx.supabase as any).rpc("trixie_access_context", { _client_id: clientId, _firm_id: null, _system: false });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row || row.mode !== "client" || row.client_id !== clientId) return null;
  const tenants = await tenantsFor(ctx, clientId);
  return {
    ...ctx,
    mode: "client",
    audience: row.audience,
    firmId: row.firm_id ?? null,
    clientId,
    tenantId: null,
    tenants,
    tenantIds: tenants.map((t: { tenantId: string }) => t.tenantId),
  };
}

async function receivablesFor(ctx: TrixieContext, clientId: string) {
  const tenants = await tenantsFor(ctx, clientId);
  if (!tenants.length) return { available: false, reason: "No connected Xero file." };
  const { readSnapshot } = await import("@/lib/xero/snapshot-read.server");
  const invoices: any[] = [];
  let asAt: string | null = null;
  let any = false;
  let blocked = 0;
  for (const t of tenants) {
    const { error } = await (ctx.supabase as any).rpc("assert_widget_access", { _tenant_id: t.tenantId, _widget: "receivables" });
    if (error) { blocked += 1; continue; }
    const hit = await readSnapshot({ supabase: ctx.supabase, tenantId: t.tenantId, clientId, reportKey: "invoices_accrec_open" }).catch(() => null);
    if (!hit) continue;
    any = true;
    invoices.push(...(hit.payload?.Invoices ?? []));
    const a = hit.source?.asAt ?? null;
    if (a && (!asAt || a > asAt)) asAt = a;
  }
  if (blocked === tenants.length) return { available: false, reason: "Receivables card not available for this client with your access — skipped." };
  if (!any) return { available: false, reason: "No saved invoices yet." };
  const s = overdueSummary(invoices);
  return { available: true, asAt, ...s, topOverdue: s.topOverdue.map((c) => ({ name: untrusted(c.name, 80), amount: c.amount })) };
}

async function practiceOverview(ctx: TrixieContext) {
  if (!deepToolsFor(ctx).includes("practice_overview")) return { available: false, reason: "Not available here.", sources: [] as Source[] };
  const rows = await overviewRows(ctx);
  const { logClientDataRead } = await import("@/lib/audit.server");
  const clients = await Promise.all(rows.map(async (r) => {
    logClientDataRead({ actorUserId: ctx.userId, clientId: r.clientId, firmId: r.firmId, tenantId: null, readKey: "trixie:practice_overview", source: "snapshot", periodStart: null, periodEnd: null });
    return {
      client: untrusted(r.clientName, 80),
      organisation: ctx.mode === "general" ? untrusted(r.firmName, 80) : undefined,
      health: (r.verdict as any)?.label ?? null,
      cashAtBank: r.cash,
      nextTax: r.taxNext,
      currentlyAccruing: r.taxBuilding,
      superDue: r.superDue,
      overdueTaxItems: r.taxItems.filter((t) => t.overdue).map((t) => ({ label: t.label, amount: t.amount, due: t.due })),
      receivables: await receivablesFor(ctx, r.clientId).catch(() => ({ available: false, reason: "Saved invoices could not be read." })),
      figuresAsAt: r.freshAsAt,
    };
  }));
  const asAt = rows.map((r) => r.freshAsAt).filter(Boolean).sort().at(-1) ?? null;
  return {
    available: true,
    note: `${UNTRUSTED_NOTE} Receivables are overdue amounts from saved open invoices; a client marked unavailable was skipped — say so.`,
    clientCount: clients.length,
    clients,
    sources: [{ label: "Organisation Overview and Receivables (saved figures)", asAt, href: ctx.mode === "organisation" && ctx.firmId ? `/firms/${ctx.firmId}` : "/overview" }] as Source[],
  };
}

const TOPICS = ["receivables", "payables", "cash", "profit_and_loss", "tax", "breakeven", "health", "key_figures"] as const;
type Topic = (typeof TOPICS)[number];
const TOPIC_READER: Record<Topic, string> = {
  receivables: "readReceivables", payables: "readPayables", cash: "readCashPosition", profit_and_loss: "readProfitAndLoss",
  tax: "readTaxObligations", breakeven: "readBreakeven", health: "readHealthVerdict", key_figures: "readCurrentClientFigures",
};

async function askAboutClient(ctx: TrixieContext, readers: ClientReaders, input: { name?: string; topics: Topic[] }) {
  if (!deepToolsFor(ctx).includes("ask_about_client")) return { available: false, reason: "Not available here.", sources: [] as Source[] };
  const clients = await accessibleClients(ctx);
  let match: AccessibleClient | null = null;
  let ownBusiness = false;
  if (input.name && input.name.trim()) {
    const found = resolveClientName(clients, input.name);
    if (found.length === 0) return { available: false, reason: "No client you can access matches that name.", sources: [] as Source[] };
    if (found.length > 1) {
      return { available: false, needsChoice: true, reason: "Several clients match; ask which one.", quickReplies: found.slice(0, 6).map((c) => c.clientName), sources: [] as Source[] };
    }
    match = found[0];
  } else {
    match = ownBusinessClient(clients, ctx.mode === "organisation" ? ctx.firmId : null);
    ownBusiness = true;
    if (!match) return { available: false, noOwnBusiness: true, reason: "This organisation's own business isn't one of its clients; answer across all clients with practice_overview.", sources: [] as Source[] };
  }
  const scoped = await scopeToClient(ctx, match.clientId);
  if (!scoped) return { available: false, reason: "That client isn't available with your access.", sources: [] as Source[] };
  const results: Record<string, unknown> = {};
  const sources: Source[] = [];
  for (const topic of [...new Set(input.topics)].slice(0, 4)) {
    const read = readers[TOPIC_READER[topic]];
    if (!read) continue;
    const out = (await read(scoped).catch(() => ({ available: false, reason: "Could not be read." }))) as any;
    results[topic] = { ...out, sources: undefined };
    for (const s of out?.sources ?? []) sources.push(s);
  }
  return {
    available: true,
    client: untrusted(match.clientName, 80),
    ownBusiness,
    note: UNTRUSTED_NOTE,
    results,
    quickReplies: ownBusiness ? ["Or see overdue amounts across all your clients?"] : [],
    sources: sources.map((s) => ({ ...s, href: `/clients/${match!.clientId}` })),
  };
}

export function buildOrgTools(ctx: TrixieContext, readers: ClientReaders): ToolSet {
  const allowed = new Set(deepToolsFor(ctx));
  const out: ToolSet = {};
  if (allowed.has("practice_overview")) {
    out.practice_overview = tool({
      description: "Staff only, organisation level. Every client the person can access: health, cash at bank, next tax due and date, super due, overdue tax, and receivables (overdue total, amount over 90 days, top 3 overdue customers). Use for 'who owes money', 'which clients…', 'across all clients'.",
      inputSchema: z.object({}),
      execute: () => practiceOverview(ctx),
    });
  }
  if (allowed.has("ask_about_client")) {
    out.ask_about_client = tool({
      description: "Staff only, organisation level. Answer about ONE client by name (partial name is fine), as if their dashboard were open. Leave `name` empty when the person says me/my/we/our business to use the organisation's own business if it is also a client.",
      inputSchema: z.object({
        name: z.string().max(100).optional().describe("Client name as the person typed it; never an identifier"),
        topics: z.array(z.enum(TOPICS)).min(1).max(4),
      }),
      execute: (i) => askAboutClient(ctx, readers, i),
    });
  }
  return out;
}

export const __test = { askAboutClient, practiceOverview };
