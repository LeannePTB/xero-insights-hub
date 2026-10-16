import { describe, expect, it } from "vitest";
import { analyseBalanceSheet } from "@/lib/xero/tax-lines";
import { SNAPSHOT_PAYLOAD_VERSION } from "@/lib/xero/snapshot-keys";
import { classifiedAccounts } from "./health-checks.server";
import { ruleProtectedMoneyVsCash } from "./rules.server";
import { seriesFor, type OverviewContext } from "@/lib/overview/overview.server";

// One cash-at-bank figure: Business Health card, Overview tax rule and the
// Overview "Cash at bank" column must agree, and a credit card never reduces it.
const cell = (v: string, id: string) => ({ Value: v, Attributes: [{ Id: "account", Value: id }] });
const BS = {
  Rows: [
    { RowType: "Section", Title: "Bank", Rows: [
      { RowType: "Row", Cells: [cell("Business Cheque", "bank-1"), { Value: "5000" }] },
      { RowType: "Row", Cells: [cell("Business Visa", "card-1"), { Value: "-4613" }] },
    ] },
    { RowType: "Section", Title: "Current Liabilities", Rows: [
      { RowType: "Row", Cells: [cell("GST", "gst-1"), { Value: "4000" }] },
    ] },
  ],
};
const ACCOUNTS = [
  { AccountID: "bank-1", Name: "Business Cheque", Class: "ASSET", Status: "ACTIVE", Type: "BANK" },
  { AccountID: "card-1", Name: "Business Visa", Class: "ASSET", Status: "ACTIVE", Type: "BANK" },
  { AccountID: "gst-1", Name: "GST", Class: "LIABILITY", Status: "ACTIVE", SystemAccount: "GST" },
];
const BANKS = [{ client_id: "c1", tenant_id: "t1", account_id: "card-1", classification: "credit_card" }] as any;

describe("cash at bank agrees everywhere", () => {
  it("card, Overview rule and Overview column all read 5,000 for a client with a credit card", () => {
    const accounts = classifiedAccounts(ACCOUNTS, BANKS)!;
    const card = analyseBalanceSheet(BS, accounts, undefined);
    const base = { payload_version: SNAPSHOT_PAYLOAD_VERSION, as_at: "2026-10-16", fetched_at: "2026-10-16T00:00:00Z", complete: true };
    const rule = ruleProtectedMoneyVsCash({ ...base, report_key: "balance_sheet", payload: BS }, { ...base, report_key: "accounts", payload: accounts });
    const ctx = {
      rowsByClient: new Map([["c1", [{ ...base, client_id: "c1", tenant_id: "t1", params: {}, report_key: "accounts", payload: accounts }]]]),
      datedByClient: new Map([["c1", [{ ...base, client_id: "c1", tenant_id: "t1", params: { date: "2026-10-16" }, report_key: "balance_sheet", payload: BS }]]]),
      overrides: new Map(), cycles: new Map(), today: "2026-10-16",
    } as unknown as OverviewContext;
    const column = seriesFor(ctx, "c1").byDate.get("2026-10-16")!.cash;

    expect(card.cashAtBank.status === "assessed" && card.cashAtBank.total).toBe(5000);
    expect(rule.debug?.cashAtBank).toBe(5000);
    expect(column).toBe(5000);
  });
});
