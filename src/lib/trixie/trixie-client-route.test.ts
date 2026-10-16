import { describe, expect, it, vi, beforeEach } from "vitest";

// Regression (16 Oct 2026): on a client's Live Dashboard Trixie answered "open a
// client" because the remembered chat was an older "general" chat, and the
// server continued it in that scope. The open client page must decide scope.

const CID = "8a1c2b3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const FID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const calls: Array<{ fn: string; args: any }> = [];

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getClaims: async () => ({ data: { claims: { aal: "aal2", sub: "owner-1" } }, error: null }) },
    rpc: async (fn: string, args: any) => {
      calls.push({ fn, args });
      if (fn === "reserve_trixie_usage") {
        return args._client_id === CID
          ? { data: [{ reservation_id: "r1", mode: "client", audience: "staff", firm_id: FID, client_id: CID, model: "m", monthly_allowance: 100, warning_threshold: 80, used: 1 }], error: null }
          : { data: [{ reservation_id: "r2", mode: "general", audience: "staff", firm_id: FID, client_id: null, model: "m", monthly_allowance: 100, warning_threshold: 80, used: 1 }], error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({ select: () => ({ eq: async () => ({ data: [{ xero_connections: { tenant_id: "t-1", tenant_name: "Positive Traction" } }] }) }) }),
  }),
}));
vi.mock("@/lib/audit.server", () => ({ logClientDataRead: vi.fn() }));

import { resolveTrixieContext } from "./trixie-context.server";
import { buildTrixieTools } from "./trixie-tools.server";
import { threadMatchesPage } from "./trixie-history";

const req = () => new Request("http://x/api/trixie", { method: "POST", headers: { authorization: "Bearer tok" } });

beforeEach(() => {
  calls.length = 0;
  process.env["SUPABASE_URL"] = "http://sb";
  process.env["SUPABASE_PUBLISHABLE_KEY"] = "pk";
});

describe("Trixie on a client page", () => {
  for (const path of [`/clients/${CID}`, `/clients/${CID}/reports`, `/clients/${CID}/settings/general`, `/clients/${CID}/settings/xero`]) {
    it(`resolves the client and offers receivables/tax tools for an owner on ${path.replace(CID, ":id")}`, async () => {
      const ctx = await resolveTrixieContext(req(), path);
      expect(calls.find((c) => c.fn === "reserve_trixie_usage")?.args._client_id).toBe(CID);
      expect(ctx.mode).toBe("client");
      expect(ctx.clientId).toBe(CID);
      expect(ctx.tenants).toEqual([{ tenantId: "t-1", name: "Positive Traction" }]);
      const names = Object.keys(buildTrixieTools(ctx));
      for (const n of ["readReceivables", "readTaxObligations", "activity_statement", "contact_history"]) expect(names).toContain(n);
    });
  }
  it("an older general chat is not continued on a client page", () => {
    expect(threadMatchesPage({ workspace: "general", firm_id: null, client_id: null }, `/clients/${CID}`)).toBe(false);
    expect(threadMatchesPage({ workspace: "client", firm_id: FID, client_id: CID }, `/clients/${CID}/reports`)).toBe(true);
    expect(threadMatchesPage({ workspace: "client", firm_id: FID, client_id: "other" }, `/clients/${CID}`)).toBe(false);
  });
  it("a gate failure is reported plainly, never as 'open a client'", async () => {
    const ctx = await resolveTrixieContext(req(), `/clients/${CID}`);
    (ctx.supabase as any).rpc = async (fn: string) => (fn === "assert_widget_access" ? { error: { message: "denied" } } : { data: null, error: null });
    const out: any = await (buildTrixieTools(ctx) as any).readReceivables.execute({}, {});
    expect(out.available).toBe(false);
    expect(JSON.stringify(out)).toMatch(/can't see this client's Receivables card/);
    expect(JSON.stringify(out)).not.toMatch(/open a client/i);
  });
});
