import { describe, expect, test } from "bun:test";
import { buildSetupRows, groupFor, looksLikeTaxAccount, progress, suggest } from "./account-setup";

const acc = (Name: string, Class: string, Type: string, extra: Record<string, string> = {}) => ({ AccountID: Name, Name, Class, Type, Status: "ACTIVE", ...extra });

describe("account setup", () => {
  test("Superannuation expense is a cost suggested as Wages, never a tax account", () => {
    const a = acc("Superannuation", "EXPENSE", "EXPENSE");
    expect(groupFor(a)).toBe("cost");
    expect(looksLikeTaxAccount(a)).toBe(false);
    expect(suggest("cost", a)).toBe("wages");
  });
  test("Superannuation Payable liability is a tax account suggested as Super owed", () => {
    const a = acc("Superannuation Payable", "LIABILITY", "CURRLIAB");
    expect(groupFor(a)).toBeNull();
    expect(looksLikeTaxAccount(a)).toBe(true);
    expect(suggest("tax", a)).toBe("super");
  });
  test("payroll on-costs suggested as Wages", () => {
    expect(suggest("cost", acc("Workers Compensation", "EXPENSE", "EXPENSE"))).toBe("wages");
    expect(suggest("cost", acc("Payroll Tax", "EXPENSE", "EXPENSE"))).toBe("wages");
  });
  test("Accounts Payable is not listed as a tax account", () => {
    expect(looksLikeTaxAccount(acc("Accounts Payable", "LIABILITY", "CURRLIAB"))).toBe(false);
  });
  test("accounts with no activity are still listed (Demo Company super bug)", () => {
    const rows = buildSetupRows([acc("Superannuation", "EXPENSE", "EXPENSE")], [], new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0].active).toBe(false);
    expect(rows[0].stored).toBeNull();
  });
  test("suggestions are not decisions; unmatched legacy rows are kept and listed", () => {
    const rows = buildSetupRows([acc("Rent", "EXPENSE", "OVERHEADS")], [
      { id: "11111111-1111-1111-1111-111111111111", account_id: null, setup_group: "cost", value: "fixed", wages_variable: false, account_name: "Old account", match_status: "unmatched" },
    ], new Set(["rent"]));
    expect(rows.find((r) => r.name === "Old account")?.unmatched).toBe(true);
    expect(progress(rows)).toEqual({ done: 0, total: 1 });
  });
});
