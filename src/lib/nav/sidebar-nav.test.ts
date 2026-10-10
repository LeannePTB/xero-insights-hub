import { describe, expect, it } from "vitest";
import {
  ORGANISATION_NAV,
  clientFileItems,
  isBranchActive,
  isItemActive,
  navForWorkspace,
  workspaceFromPath,
} from "./sidebar-nav";

describe("workspaceFromPath", () => {
  it("maps addresses to workspaces", () => {
    expect(workspaceFromPath("/system/security")).toEqual({ kind: "system" });
    expect(workspaceFromPath("/firms/f1/people")).toEqual({ kind: "organisation", firmId: "f1" });
    expect(workspaceFromPath("/clients/c1/reports")).toEqual({ kind: "client", clientId: "c1" });
    expect(workspaceFromPath("/clients/new")).toEqual({ kind: "none" });
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
  it("hides Payables/Receivables with no files", () => {
    expect(clientFileItems([])).toEqual([]);
  });
  it("links straight through with one file", () => {
    const [p] = clientFileItems([{ tenantId: "t1", name: "A" }]);
    expect(p.to).toBe("/clients/$clientId/payables/t1");
    expect(p.children).toBeUndefined();
  });
  it("lists each file as a sub-item with several", () => {
    const [, r] = clientFileItems([{ tenantId: "t1", name: "A" }, { tenantId: "t2", name: "B" }]);
    expect(r.children?.map((c) => c.to)).toEqual(["/clients/$clientId/receivables/t1", "/clients/$clientId/receivables/t2"]);
  });
});

describe("organisation settings", () => {
  it("has the five settings sections", () => {
    const settings = ORGANISATION_NAV[0].items.find((i) => i.id === "settings")!;
    expect(settings.children?.map((c) => c.label)).toEqual(["General", "Card defaults", "Subscription", "Ownership", "Support access"]);
  });
});
