import { describe, it, expect } from "vitest";
import { extractTaxLines, statutoryOverrideMap } from "@/lib/xero/tax-lines";
import { sgQuarterRows } from "@/lib/payday-super";

const accounts = { Accounts: [
  { AccountID: "a826", Name: "Superannuation Payable", Code: "826", Type: "CURRLIAB", Class: "LIABILITY", Status: "ACTIVE" },
  { AccountID: "a820", Name: "GST", Type: "CURRLIAB", Class: "LIABILITY", Status: "ACTIVE", SystemAccount: "GST" },
]};
const bs = { Rows: [{ RowType: "Section", Title: "Current Liabilities", Rows: [
  { RowType: "Row", Cells: [{ Value: "GST", Attributes: [{ Id: "account", Value: "a820" }] }, { Value: "1000.00" }] },
]}]};

describe("tagged statutory account missing from the balance sheet", () => {
  it("super tagged 'Super owed' but absent from the report is A$0.00, not missing", () => {
    const r = extractTaxLines(bs as any, accounts, statutoryOverrideMap([{ account_name: "Superannuation Payable", category: "super" }]));
    const sup = r.lines.filter((l) => l.category === "super");
    expect(sup).toEqual([{ name: "Superannuation Payable", amount: 0, category: "super", accountId: "a826" }]);
    expect(r.lines.find((l) => l.category === "gst")?.amount).toBe(1000);
  });
  it("an account tagged 'none' is never added", () => {
    const r = extractTaxLines(bs as any, accounts, statutoryOverrideMap([{ account_name: "Superannuation Payable", category: "none" }]));
    expect(r.lines.some((l) => l.category === "super")).toBe(false);
  });
});

describe("SG quarter due dates", () => {
  it("Jul–Sep due 28 Oct, Oct–Dec due 28 Jan", () => {
    const rows = sgQuarterRows("2026-11-05", [{ paymentDate: "2026-09-15", super: 200 }, { paymentDate: "2026-10-15", super: 50 }]);
    expect(rows.map((r) => [r.label, r.due, r.superFromPayRuns])).toEqual([["Jul–Sep 2026", "2026-10-28", 200], ["Oct–Dec 2026", "2027-01-28", 50]]);
  });
});
