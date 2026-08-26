import { describe, expect, it } from "vitest";
import { xeroMemoKey } from "./request-memo.server";

describe("xeroMemoKey", () => {
  it("separates tenants so two organisations can never share a cache slot", () => {
    const a = xeroMemoKey("accounting", "tenant-a", "Reports/BalanceSheet", {
      date: "2026-08-31",
    });
    const b = xeroMemoKey("accounting", "tenant-b", "Reports/BalanceSheet", {
      date: "2026-08-31",
    });
    expect(a).not.toBe(b);
  });

  it("separates as-at dates and reporting bases", () => {
    const base = {
      tenantId: "tenant-a",
      path: "Reports/ProfitAndLoss",
      params: { fromDate: "2026-07-01", toDate: "2026-07-31" },
    };

    const july = xeroMemoKey("accounting", base.tenantId, base.path, base.params);
    const august = xeroMemoKey("accounting", base.tenantId, base.path, {
      ...base.params,
      toDate: "2026-08-31",
    });
    const cashBasis = xeroMemoKey("accounting", base.tenantId, base.path, {
      ...base.params,
      paymentsOnly: "true",
    });

    expect(july).not.toBe(august);
    expect(july).not.toBe(cashBasis);
    expect(august).not.toBe(cashBasis);
  });

  it("separates the Accounting API from the Assets API even with identical paths", () => {
    const accounting = xeroMemoKey("accounting", "tenant-a", "Assets", {
      status: "DRAFT",
    });
    const assets = xeroMemoKey("assets", "tenant-a", "Assets", {
      status: "DRAFT",
    });
    expect(accounting).not.toBe(assets);
  });

  it("is insensitive to argument order and drops empty or undefined params", () => {
    const ordered = xeroMemoKey("accounting", "tenant-a", "Reports/TrialBalance", {
      date: "2026-08-31",
      trackingOptionID1: "",
      trackingOptionID2: undefined,
      paymentsOnly: "false",
    });
    const reversed = xeroMemoKey("accounting", "tenant-a", "Reports/TrialBalance", {
      paymentsOnly: "false",
      trackingOptionID2: undefined,
      trackingOptionID1: "",
      date: "2026-08-31",
    });
    expect(ordered).toBe(reversed);
    expect(ordered).not.toContain("trackingOptionID");
  });

  it("cannot be forged by a value containing the internal separator", () => {
    const key = xeroMemoKey("accounting", "tenant-a", "Accounts", {
      where: `Status=="ACTIVE"\u0000base\u0000tenant-a\u0000Accounts`,
    });
    const forged = xeroMemoKey("accounting", "tenant-a", "Accounts", {
      where: 'Status=="ACTIVE"',
    });
    expect(key).not.toBe(forged);
    expect(key).not.toContain("\u0000tenant-a\u0000Accounts");
  });
});
