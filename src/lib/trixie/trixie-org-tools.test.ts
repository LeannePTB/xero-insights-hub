import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/audit.server", () => ({ logClientDataRead: vi.fn() }));
const rows = [
  { clientId: "c1", clientName: "Positive Traction", firmId: "f1", firmName: "Positive Traction" },
  { clientId: "c2", clientName: "Mackay Traders Pty Ltd", firmId: "f1", firmName: "Positive Traction" },
  { clientId: "c3", clientName: "Mackay Motors", firmId: "f1", firmName: "Positive Traction" },
];
vi.mock("@/lib/overview/overview.server", () => ({ buildOverview: vi.fn(async () => ({ rows })) }));
import { buildOrgTools } from "./trixie-org-tools.server";
import { resolveClientName, ownBusinessClient, overdueSummary } from "./trixie-org-logic";
import { deepToolsFor, FORBIDDEN_SCHEMA_KEY } from "./trixie-tool-policy";

const ctx = (over: Record<string, unknown> = {}, access: (id: string) => any = (id) => ({ mode: "client", client_id: id, audience: "staff", firm_id: "f1" })) => ({
  mode: "organisation", audience: "staff", firmId: "f1", clientId: null, tenants: [], userId: "u", route: { pathname: "/firms/f1" },
  supabase: {
    rpc: vi.fn(async (n: string, a: any) => (n === "trixie_access_context" ? { data: access(a._client_id), error: access(a._client_id) ? null : { message: "Forbidden" } } : { error: null })),
    from: () => ({ select: () => ({ eq: async () => ({ data: [] }) }) }),
  },
  ...over,
}) as any;

describe("client name resolution", () => {
  it("matches only the caller's accessible clients, case-insensitive and partial", () => {
    expect(resolveClientName(rows, "positive traction").map((c) => c.clientId)).toEqual(["c1"]);
    expect(resolveClientName(rows, "mackay traders").map((c) => c.clientId)).toEqual(["c2"]);
    expect(resolveClientName(rows, "Mackay").length).toBe(2);
  });
  it("a client from another organisation never matches", () => {
    expect(resolveClientName(rows, "Red Panda Cafe")).toEqual([]);
  });
  it("finds the organisation's own business", () => {
    expect(ownBusinessClient(rows, "f1")?.clientId).toBe("c1");
    expect(ownBusinessClient(rows, "other")).toBeNull();
  });
  it("summarises overdue receivables", () => {
    const s = overdueSummary([
      { AmountDue: 100, DueDate: "2026-01-01", Contact: { Name: "A" } },
      { AmountDue: 50, DueDate: "2026-10-01", Contact: { Name: "B" } },
      { AmountDue: 70, DueDate: "2027-01-01", Contact: { Name: "C" } },
    ], new Date("2026-10-16"));
    expect(s).toEqual({ overdueTotal: 150, over90Days: 100, topOverdue: [{ name: "A", amount: 100 }, { name: "B", amount: 50 }] });
  });
});

describe("organisation tools", () => {
  const readers = { readReceivables: vi.fn(async () => ({ available: true, totalOverdue: 1, sources: [] })) };
  it("several matches ask which, with names as quick replies", async () => {
    const t = buildOrgTools(ctx(), readers) as any;
    const out = await t.ask_about_client.execute({ name: "mackay", topics: ["receivables"] }, {});
    expect(out.needsChoice).toBe(true);
    expect(out.quickReplies).toEqual(["Mackay Traders Pty Ltd", "Mackay Motors"]);
  });
  it("me/my answers for the organisation's own business and offers all clients", async () => {
    const out = await (buildOrgTools(ctx(), readers) as any).ask_about_client.execute({ topics: ["receivables"] }, {});
    expect(out.available).toBe(true);
    expect(out.quickReplies[0]).toMatch(/across all your clients/);
  });
  it("the database access check still applies to a matched name", async () => {
    const out = await (buildOrgTools(ctx({}, () => null), readers) as any).ask_about_client.execute({ name: "positive", topics: ["receivables"] }, {});
    expect(out.available).toBe(false);
  });
  it("viewers, Business Owners and System Admin get no organisation tools", () => {
    expect(Object.keys(buildOrgTools(ctx({ audience: "viewer" }), readers))).toEqual([]);
    expect(Object.keys(buildOrgTools(ctx({ mode: "client", audience: "viewer", clientId: "c1" }), readers))).toEqual([]);
    expect(deepToolsFor(ctx({ mode: "platform", audience: "platform" }))).toEqual([]);
  });
  it("schemas take no identifiers", () => {
    for (const [n, t] of Object.entries(buildOrgTools(ctx(), readers) as any)) {
      for (const k of Object.keys((t as any).inputSchema.shape ?? {})) expect(FORBIDDEN_SCHEMA_KEY.test(k), `${n}.${k}`).toBe(false);
    }
  });
});
