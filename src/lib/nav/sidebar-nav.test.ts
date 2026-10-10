import { describe, expect, it } from "vitest";
import {
  ORGANISATION_NAV,
  allOrganisationsNav,
  clientFileItems,
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
    expect(xero.to).toBe("/clients/$clientId/audit/t1");
    expect(xero.children?.map((child) => child.to)).toEqual([
      "/clients/$clientId/payables/t1",
      "/clients/$clientId/receivables/t1",
      "/clients/$clientId/audit/t1",
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
    expect(settings.children?.map((c) => c.label)).toEqual(["General", "Card defaults", "Subscription", "Ownership", "Support access"]);
  });
});
