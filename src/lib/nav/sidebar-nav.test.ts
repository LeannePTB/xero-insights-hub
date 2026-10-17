import { describe, expect, it } from "vitest";
import {
  ORGANISATION_NAV,
  allOrganisationsNav,
  clientFileItems,
  clientNav,
  CLIENT_NAV,
  isBranchActive,
  isItemActive,
  navForWorkspace,
  resolveWorkspace,
  workspaceFromPath,
} from "./sidebar-nav";

describe("workspaceFromPath", () => {
  it("maps addresses to workspaces", () => {
    expect(workspaceFromPath("/system")).toEqual({ kind: "system" });
    expect(workspaceFromPath("/system/security")).toEqual({ kind: "system" });
    expect(workspaceFromPath("/overview")).toEqual({ kind: "all" });
    expect(workspaceFromPath("/overview/")).toEqual({ kind: "all" });
    expect(workspaceFromPath("/firms/f1")).toEqual({ kind: "organisation", firmId: "f1" });
    expect(workspaceFromPath("/firms/f1/people")).toEqual({ kind: "organisation", firmId: "f1" });
    expect(workspaceFromPath("/clients/c1")).toEqual({ kind: "client", clientId: "c1" });
    expect(workspaceFromPath("/clients/c1/reports")).toEqual({ kind: "client", clientId: "c1" });
    expect(workspaceFromPath("/clients/new")).toEqual({ kind: "none" });
    expect(workspaceFromPath("/settings/account")).toEqual({ kind: "none" });
    expect(workspaceFromPath("/settings/activity")).toEqual({ kind: "none" });
  });
});

describe("resolveWorkspace", () => {
  it("never keeps a stale workspace once the address names one", () => {
    expect(resolveWorkspace("/overview", { kind: "organisation", firmId: "f1" })).toEqual({ kind: "all" });
    expect(resolveWorkspace("/firms/f2", { kind: "all" })).toEqual({ kind: "organisation", firmId: "f2" });
    expect(resolveWorkspace("/system", { kind: "organisation", firmId: "f1" })).toEqual({ kind: "system" });
  });
  it("keeps the last workspace on account pages only", () => {
    expect(resolveWorkspace("/settings/account", { kind: "all" })).toEqual({ kind: "all" });
    expect(resolveWorkspace("/settings/activity", { kind: "organisation", firmId: "f1" })).toEqual({
      kind: "organisation",
      firmId: "f1",
    });
  });
});

describe("all organisations menu", () => {
  const orgs = [
    { id: "f1", name: "Autotek NSW", clientCount: 4 },
    { id: "f2", name: "Empty Org", clientCount: 0 },
  ];
  it("lists the overview then each organisation, with no organisation settings", () => {
    const groups = allOrganisationsNav(orgs);
    expect(groups[0].items[0].to).toBe("/overview");
    expect(groups[1].label).toBe("Your organisations");
    expect(groups[1].items.map((i) => i.to)).toEqual(["/firms/f1/overview", "/firms/f2"]);
    const ids = groups.flatMap((g) => g.items.map((i) => i.id));
    expect(ids.some((id) => ["settings", "people", "xero-files"].includes(id))).toBe(false);
  });
  it("is the menu chosen for the all-organisations workspace", () => {
    const groups = navForWorkspace({ kind: "all" }, { canSeeSystem: false, organisations: orgs });
    expect(groups[0].items[0].label).toBe("All organisations");
  });
  it("highlights the overview item on /overview", () => {
    const [group] = allOrganisationsNav([]);
    expect(isItemActive(group.items[0], "/overview", {})).toBe(true);
    expect(isItemActive(group.items[0], "/firms/f1/overview", {})).toBe(false);
  });
});

describe("navForWorkspace", () => {
  it("shows System Admin only to super admins", () => {
    expect(navForWorkspace({ kind: "system" }, { canSeeSystem: false })).toEqual([]);
    expect(navForWorkspace({ kind: "system" }, { canSeeSystem: true }).length).toBeGreaterThan(0);
  });
});

describe("active matching", () => {
  const consolidations = ORGANISATION_NAV[0].items.find((i) => i.id === "consolidations")!;
  it("expands the parent when a child is active", () => {
    expect(isBranchActive(consolidations, "/firms/f1/loans/accounts", { firmId: "f1" })).toBe(true);
  });
  it("exact items do not match deeper paths", () => {
    const matrix = consolidations.children!.find((c) => c.id === "loan-matrix")!;
    expect(isItemActive(matrix, "/firms/f1/loans/accounts", { firmId: "f1" })).toBe(false);
    expect(isItemActive(matrix, "/firms/f1/loans", { firmId: "f1" })).toBe(true);
  });
});

describe("client Xero file items", () => {
  it("hides Xero-file links with no files", () => {
    expect(clientFileItems([])).toEqual([]);
  });
  it("links straight through with one file", () => {
    const [xero] = clientFileItems([{ tenantId: "t1", name: "A" }]);
    // Xero file audit retired 17 Oct 2026: no audit link.
    expect(xero.to).toBe("/clients/$clientId/payables/t1");
    expect(xero.children?.map((child) => child.to)).toEqual([
      "/clients/$clientId/payables/t1",
      "/clients/$clientId/receivables/t1",
    ]);
  });
  it("lists each file as a sub-item with several", () => {
    const [xero] = clientFileItems([{ tenantId: "t1", name: "A" }, { tenantId: "t2", name: "B" }]);
    const receivables = xero.children?.find((child) => child.id === "receivables");
    expect(receivables?.children?.map((c) => c.to)).toEqual(["/clients/$clientId/receivables/t1", "/clients/$clientId/receivables/t2"]);
  });
});

describe("organisation settings", () => {
  it("has the five settings sections", () => {
    const settings = ORGANISATION_NAV[0].items.find((i) => i.id === "settings")!;
    expect(settings.children?.map((c) => c.label)).toEqual(["General", "Default modules", "Subscription", "Ownership", "Support access"]);
  });
});

describe("client menu follows the client's visible cards (client_visible_cards)", () => {
  const files = [{ tenantId: "t1", name: "Demo Company (AU)" }];
  const STANDARD = ["health", "notes", "payables", "pnl", "receivables"];
  const flat = (groups: ReturnType<typeof clientNav>) => {
    const out: { id: string; cardKey?: string }[] = [];
    const walk = (items: { id: string; cardKey?: string; children?: any[] }[]) =>
      items.forEach((i) => { out.push(i); if (i.children) walk(i.children); });
    groups.forEach((g) => walk(g.items));
    return out;
  };

  it("a Standard-only client shows no Advisory or Consolidation items", () => {
    const items = flat(clientNav(files, STANDARD));
    const ids = items.map((i) => i.id);
    expect(ids).not.toContain("cashflow");
    expect(ids).not.toContain("loans");
    expect(ids).not.toContain("loan-matrix");
    expect(ids).not.toContain("loan-accounts");
    expect(ids).not.toContain("audit");
    expect(ids).toEqual(expect.arrayContaining(["dashboard", "reports", "payables", "receivables"]));
  });

  it("Advisory and Consolidation items appear only when their card is visible", () => {
    const ids = flat(clientNav(files, [...STANDARD, "cashflow_scenario", "xero_audit", "loan_consolidation"])).map((i) => i.id);
    expect(ids).not.toContain("cashflow"); // removed 14 Oct: the card's Open button is the entry point
    expect(ids).toEqual(expect.arrayContaining(["loans", "loan-matrix", "loan-accounts"]));
    expect(ids).not.toContain("audit"); // retired 17 Oct 2026
  });

  it("an unknown or failed card list hides every card item (fail closed)", () => {
    const items = flat(clientNav(files, null));
    expect(items.filter((i) => i.cardKey)).toEqual([]);
    expect(items.map((i) => i.id)).not.toContain("xero-files");
  });

  it("the Xero files parent points at a card that is still visible", () => {
    const [group] = clientNav(files, STANDARD);
    const xero = group!.items.find((i) => i.id === "xero-files")!;
    expect(xero.to).toBe("/clients/$clientId/payables/t1");
  });

  it("every client item that opens a card page names its catalogue card", () => {
    const CARD_ROUTES: Record<string, string> = {
      "/clients/$clientId/cashflow-scenario": "cashflow_scenario",
      "/clients/$clientId/loans": "loan_consolidation",
      "/clients/$clientId/loans-accounts": "loan_consolidation",
    };
    const items = flat([...CLIENT_NAV, { id: "x", label: "x", items: clientFileItems(files) }]) as any[];
    for (const i of items) {
      if (CARD_ROUTES[i.to]) expect(i.cardKey, i.id).toBe(CARD_ROUTES[i.to]);
      if (/\/(audit|payables|receivables)\//.test(i.to) && i.id !== "xero-files") expect(i.cardKey, i.id).toBeTruthy();
    }
  });
});

describe("Loans / Consolidations menu follow the server owner-or-team signal (14 Oct 2026)", () => {
  const ids = (g: ReturnType<typeof navForWorkspace>) => g.flatMap((x) => x.items.map((i) => i.id));
  const cards = ["loan_consolidation", "pnl"];
  it("hides client Loans without the signal, even with the card visible", () => {
    const g = navForWorkspace({ kind: "client", clientId: "c" } as any, { canSeeSystem: false, clientVisibleCards: cards });
    expect(ids(g)).not.toContain("loans");
  });
  it("shows client Loans with the signal and the card", () => {
    const g = navForWorkspace({ kind: "client", clientId: "c" } as any, { canSeeSystem: false, clientVisibleCards: cards, canOpenLoans: true });
    expect(ids(g)).toContain("loans");
  });
  it("hides organisation Consolidations without the signal", () => {
    expect(ids(navForWorkspace({ kind: "organisation", firmId: "f" }, { canSeeSystem: false }))).not.toContain("consolidations");
    expect(ids(navForWorkspace({ kind: "organisation", firmId: "f" }, { canSeeSystem: false, canOpenConsolidations: true }))).toContain("consolidations");
  });
});

describe("locked Advisory menu item", () => {
  const ids = (locked?: string[]) => navForWorkspace({ kind: "client", clientId: "c1" }, { canSeeSystem: false, clientVisibleCards: ["pnl"], lockedModules: locked })[0]!.items.map((i) => i.id);
  it("shows one Advisory item when the server lists locked modules", () => {
    expect(ids(["cash_flow", "profit"]).filter((i) => i === "advisory-locked")).toHaveLength(1);
  });
  it("hides it when the server lists none", () => {
    expect(ids([])).not.toContain("advisory-locked");
    expect(ids(undefined)).not.toContain("advisory-locked");
  });
});
