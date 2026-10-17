import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mapCatalogue, offeredCatalogue, catalogueGuideText, activeModules } from "@/lib/cards/catalogue";
import { clientNav } from "@/lib/nav/sidebar-nav";
import { dashboardPackageSummary } from "@/components/dashboard/dashboard-card-layout";

// Owner decision 17 Oct 2026: Bookkeeping checks (xero_audit, transaction_search) retired.
const modules = [
  { module_key: "tax_compliance", label: "Tax & Compliance" },
  { module_key: "bookkeeping_checks", label: "Bookkeeping Checks" },
];
const cards = [
  { card_key: "pnl", package: "standard", module_key: null, label: "Profit & loss", status: "available" },
  { card_key: "tax_obligations", package: "advisory", module_key: "tax_compliance", label: "Tax obligations", status: "available" },
  { card_key: "xero_audit", package: "advisory", module_key: "bookkeeping_checks", label: "Xero file audit", status: "retired" },
  { card_key: "transaction_search", package: "advisory", module_key: "bookkeeping_checks", label: "Transaction search", status: "retired" },
];

describe("Bookkeeping checks retired", () => {
  const cat = mapCatalogue(modules, cards);
  it("retired cards are dropped from every catalogue view, System Admin's included", () => {
    expect(cat.cards.map((c) => c.key)).not.toContain("xero_audit");
    expect(cat.cards.map((c) => c.key)).not.toContain("transaction_search");
    expect(activeModules(cat).map((m) => m.key)).not.toContain("bookkeeping_checks");
    expect(offeredCatalogue(cat).modules.map((m) => m.key)).toEqual(["tax_compliance"]);
  });
  it("Trixie's package guide and the dashboard subtitle don't mention it, even with old ticks", () => {
    expect(catalogueGuideText(cat)).not.toMatch(/Bookkeeping|audit|Transaction search/i);
    expect(dashboardPackageSummary(cat, ["pnl", "tax_obligations", "xero_audit", "transaction_search"])).toBe("Standard + Advisory (Tax & Compliance)");
  });
  it("the client menu no longer links the Xero file audit", () => {
    const items = clientNav([{ tenantId: "t1", name: "File" }], ["payables", "receivables", "xero_audit"]).flatMap((g) => g.items).flatMap((i) => [i, ...(i.children ?? [])]);
    expect(items.some((i) => /\/audit\//.test(i.to))).toBe(false);
  });
  it("database readers gate on status 'available' only (retired refused for every role)", () => {
    const sql = readFileSync("drizzle/migrations/0068_roadmap_contact_suppression_retired.sql", "utf8");
    expect(sql).toMatch(/status in \('available','retired'\)/);
  });
});

describe("Alert address unblock", () => {
  const sql = readFileSync("drizzle/migrations/0068_roadmap_contact_suppression_retired.sql", "utf8");
  const fn = sql.slice(sql.indexOf("FUNCTION public.admin_unblock_alert_address"));
  it("removes only the configured alert address, behind aal2 + System Administrator, audited", () => {
    expect(fn).toMatch(/assert_aal2\(\)/);
    expect(fn).toMatch(/assert_super_admin\(\)/);
    expect(fn).toMatch(/delete from public\.suppressed_emails where lower\(email\) = _addr;/);
    expect(fn).toMatch(/select lower\(b\.enquiry_alert_email\) into _addr/);
    expect(fn).toMatch(/alert_address_unblocked/);
    expect(fn).not.toMatch(/_email text|\(_addr text/);
  });
  it("main contact save is System Administrator + aal2 + audited", () => {
    const f = sql.slice(sql.indexOf("FUNCTION public.admin_set_main_contact_email"));
    expect(f).toMatch(/assert_aal2\(\)[\s\S]*assert_super_admin\(\)[\s\S]*platform_main_contact_changed/);
  });
});
