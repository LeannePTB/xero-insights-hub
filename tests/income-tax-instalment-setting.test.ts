import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const mig = readdirSync("drizzle/migrations").filter((f) => f.includes("income_tax_instalment_frequency")).map((f) => readFileSync(`drizzle/migrations/${f}`, "utf8")).join("\n");
const setter = mig.slice(mig.indexOf("FUNCTION public.set_client_income_tax_instalment_frequency"));

describe("instalment setting", () => {
  it("only the organisation team (write predicate) can save; Business Owner/Viewer read grants never write", () => {
    expect(setter).toContain("app_private.user_can_write_client(_actor, _client_id)");
    expect(setter.split("REVOKE")[0]).not.toMatch(/has_client_read_access|has_client_access|has_standing_client_access/);
    expect(setter).toContain("assert_aal2");
    expect(setter).toContain("audit_log");
  });
  it("never silently marks anyone Not required", () => {
    expect(mig).not.toMatch(/SET income_tax_instalment_frequency = 'not_required'/);
  });
  it("the dashboard card has no instalment edit control for any role", () => {
    const card = readFileSync("src/components/dashboard/TaxObligationsWidget.tsx", "utf8") + readFileSync("src/components/dashboard/TaxObligationsBody.tsx", "utf8");
    expect(card).not.toMatch(/saveIncomeTaxInstalment|Add instalment|<form/);
  });
  it("final/sent reports are never rebuilt for the wages split", () => {
    const src = readFileSync("src/lib/reports/monthly-report.ts", "utf8");
    expect(src).toMatch(/MONTHLY_REPORT_PAYLOAD_VERSION = 14/);
  });
});
