import { describe, expect, it } from "vitest";
import { filterAndSortOrganisations, organisationStatus, type AdminOrganisationRow } from "./system-organisations";

const row = (name: string, extras: Partial<AdminOrganisationRow> = {}): AdminOrganisationRow => ({
  firm: { firm_id: name, firm_name: name, is_always_free: false, firm_created_at: "2026-01-01", status: "active" },
  ...extras,
});

describe("system organisation list", () => {
  it("treats at-limit as normal and only exposes the numeric usage for sorting", () => {
    const rows = [row("Nine", { usage: { firmId: "Nine", clientsUsed: 9, clientLimit: 9, xeroFilesUsed: 0, xeroOrgLimit: 9, dashboards: {}, dashboardsPartial: false, unsetLodgementCycles: 0 } }), row("One", { usage: { firmId: "One", clientsUsed: 1, clientLimit: 1, xeroFilesUsed: 0, xeroOrgLimit: 1, dashboards: {}, dashboardsPartial: false, unsetLodgementCycles: 0 } })];
    expect(filterAndSortOrganisations(rows, "", "all", "clients", "desc").map((x) => x.firm.firm_name)).toEqual(["Nine", "One"]);
  });

  it("filters attention and overdue without granting or deriving access", () => {
    const attention = row("Attention", { usage: { firmId: "Attention", clientsUsed: 1, clientLimit: 1, xeroFilesUsed: 0, xeroOrgLimit: 1, dashboards: {}, dashboardsPartial: false, unsetLodgementCycles: 1 } });
    const overdue = row("Overdue", { state: { firmId: "Overdue", planKey: null, planLabel: null, status: "past_due", lapsed: true, alwaysFree: false, isFree: false, endsAt: null, daysRemaining: null, endingSoon: false, consolidation: false } });
    expect(filterAndSortOrganisations([attention, overdue], "", "attention", "name", "asc")).toEqual([attention]);
    expect(filterAndSortOrganisations([attention, overdue], "", "overdue", "name", "asc")).toEqual([overdue]);
    expect(organisationStatus(overdue)?.label).toBe("Lapsed");
  });
});