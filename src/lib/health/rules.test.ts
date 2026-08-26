import assert from "node:assert";
import { describe, it } from "node:test";
import { SNAPSHOT_PAYLOAD_VERSION } from "@/lib/xero/snapshot-keys";
import {
  evaluateClient,
  rankFindings,
  ruleDebtors,
  ruleProtectedMoneyVsCash,
  type Finding,
  type SnapshotRow,
} from "./rules.server";

const NOW = new Date("2026-08-26T02:00:00Z");
const FRESH = "2026-08-25T17:10:00Z";
const OLD = "2026-08-20T17:10:00Z";

function row(over: Partial<SnapshotRow> & Pick<SnapshotRow, "report_key" | "payload">): SnapshotRow {
  return {
    payload_version: SNAPSHOT_PAYLOAD_VERSION,
    as_at: "2026-08-26",
    fetched_at: FRESH,
    complete: true,
    ...over,
  };
}

/** A Balance Sheet payload with the given bank and tax lines. */
function balanceSheet(bank: number, tax: { name: string; amount: number }[]) {
  return {
    Rows: [
      {
        RowType: "Section",
        Title: "Bank",
        Rows: [{ RowType: "Row", Cells: [{ Value: "Business Cheque" }, { Value: String(bank) }] }],
      },
      {
        RowType: "Section",
        Title: "Current Liabilities",
        Rows: tax.map((t) => ({ RowType: "Row", Cells: [{ Value: t.name }, { Value: String(t.amount) }] })),
      },
    ],
  };
}

const FULL_TAX = [
  { name: "GST", amount: 40_000 },
  { name: "PAYG Withholding Payable", amount: 15_000 },
  { name: "Superannuation Payable", amount: 10_000 },
];

function invoicePayload(invoices: { due: number; dueDate: string; contact: string }[]) {
  return {
    Invoices: invoices.map((i) => ({
      AmountDue: i.due,
      DueDate: i.dueDate,
      Contact: { Name: i.contact },
    })),
  };
}

const HEALTHY_DEBTORS = row({
  report_key: "invoices_accrec_open",
  payload: invoicePayload([
    { due: 5_000, dueDate: "2026-09-20", contact: "Alpha" },
    { due: 5_000, dueDate: "2026-09-21", contact: "Beta" },
    { due: 4_000, dueDate: "2026-09-22", contact: "Gamma" },
  ]),
});

const CONNECTED = [{ tenantId: "t1", status: "connected" }];

describe("R01 protected money vs cash", () => {
  it("fires critical when protected money exceeds cash at bank", () => {
    const r = ruleProtectedMoneyVsCash(row({ report_key: "balance_sheet", payload: balanceSheet(50_000, FULL_TAX) }));
    assert.ok(r.finding);
    assert.strictEqual(r.finding!.severity, "critical");
    assert.strictEqual(r.finding!.ruleId, "R01");
  });

  it("does not fire when protected money is well under cash", () => {
    const r = ruleProtectedMoneyVsCash(row({ report_key: "balance_sheet", payload: balanceSheet(500_000, FULL_TAX) }));
    assert.strictEqual(r.finding, null);
    assert.strictEqual(r.unavailable, undefined);
  });

  it("never treats an unmatched component as zero", () => {
    // No superannuation account at all: the component is unresolved.
    const payload = balanceSheet(500_000, [
      { name: "GST", amount: 1_000 },
      { name: "PAYG Withholding Payable", amount: 500 },
    ]);
    const r = ruleProtectedMoneyVsCash(row({ report_key: "balance_sheet", payload }));
    assert.strictEqual(r.finding, null);
    assert.match(r.unavailable ?? "", /super/);
  });
});

describe("R06 debtors", () => {
  it("does not fire on a truncated (complete = false) invoice payload", () => {
    const payload = invoicePayload([{ due: 100_000, dueDate: "2020-01-01", contact: "Ancient Co" }]);
    const r = ruleDebtors(row({ report_key: "invoices_accrec_open", payload, complete: false }));
    assert.strictEqual(r.finding, null);
    assert.match(r.unavailable ?? "", /incomplete/i);
  });

  it("fires critical when the book is badly aged", () => {
    const payload = invoicePayload([
      { due: 60_000, dueDate: "2026-01-01", contact: "Ancient Co" },
      { due: 40_000, dueDate: "2026-09-01", contact: "Current Co" },
    ]);
    const r = ruleDebtors(row({ report_key: "invoices_accrec_open", payload }));
    assert.strictEqual(r.finding?.severity, "critical");
  });
});

describe("coverage gate", () => {
  const healthyBs = row({ report_key: "balance_sheet", payload: balanceSheet(500_000, FULL_TAX) });

  it("green only when everything is present, current and complete", () => {
    const v = evaluateClient({
      clientId: "c1",
      connections: CONNECTED,
      snapshots: [healthyBs, HEALTHY_DEBTORS],
      now: NOW,
    });
    assert.strictEqual(v.state, "ok");
  });

  it("stale snapshots produce a stale state, never green", () => {
    const v = evaluateClient({
      clientId: "c1",
      connections: CONNECTED,
      snapshots: [{ ...healthyBs, fetched_at: OLD }, HEALTHY_DEBTORS],
      now: NOW,
    });
    assert.strictEqual(v.state, "stale");
  });

  it("a missing required key produces a partial state, never green", () => {
    const v = evaluateClient({ clientId: "c1", connections: CONNECTED, snapshots: [healthyBs], now: NOW });
    assert.strictEqual(v.state, "partial");
  });

  it("a wrong payload_version is treated as absent, never green", () => {
    const v = evaluateClient({
      clientId: "c1",
      connections: CONNECTED,
      snapshots: [{ ...healthyBs, payload_version: SNAPSHOT_PAYLOAD_VERSION + 1 }, HEALTHY_DEBTORS],
      now: NOW,
    });
    assert.strictEqual(v.state, "partial");
  });

  it("a disconnected Xero connection produces its own state, never green", () => {
    const v = evaluateClient({
      clientId: "c1",
      connections: [{ tenantId: "t1", status: "disconnected" }],
      snapshots: [healthyBs, HEALTHY_DEBTORS],
      now: NOW,
    });
    assert.strictEqual(v.state, "disconnected");
  });

  it("no linked Xero organisation produces no_data", () => {
    const v = evaluateClient({ clientId: "c1", connections: [], snapshots: [], now: NOW });
    assert.strictEqual(v.state, "no_data");
  });
});

describe("ranking", () => {
  const make = (ruleId: string, consequenceScore: number, daysToConsequence: number | null): Finding => ({
    ruleId,
    title: ruleId,
    detail: "",
    severity: "warning",
    consequenceScore,
    daysToConsequence,
  });

  it("highest consequence score wins, ties broken by time to consequence", () => {
    const ranked = rankFindings([make("R05", 60, 10), make("R01", 90, null), make("R06", 90, 0)]);
    assert.deepStrictEqual(
      ranked.map((f) => f.ruleId),
      ["R06", "R01", "R05"],
    );
  });
});
