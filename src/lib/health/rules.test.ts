import assert from "node:assert";
import { describe, it } from "node:test";
import { SNAPSHOT_PAYLOAD_VERSION } from "@/lib/xero/snapshot-keys";
import {
  evaluateClient,
  evaluateFromRows,
  rankFindings,
  ruleDebtors,
  ruleProtectedMoneyVsCash,
  type Finding,
  type SnapshotRow,
} from "./rules.server";
import { analyseBalanceSheet, classifyTaxLine } from "@/lib/xero/tax-lines";

const NOW = new Date("2026-08-26T02:00:00Z");
const FRESH = "2026-08-25T17:10:00Z";
const OLD = "2026-08-20T17:10:00Z";

function row(
  over: Partial<SnapshotRow> & Pick<SnapshotRow, "report_key" | "payload">,
): SnapshotRow {
  return {
    payload_version: SNAPSHOT_PAYLOAD_VERSION,
    as_at: "2026-08-26",
    fetched_at: FRESH,
    complete: true,
    ...over,
  };
}

type TestLine = { name: string; amount: number; accountId: string };

function accountCell(value: string, accountId: string) {
  return { Value: value, Attributes: [{ Id: "account", Value: accountId }] };
}

/** A Balance Sheet payload with the given bank and tax lines. */
function balanceSheet(bank: number, tax: TestLine[]) {
  return {
    Rows: [
      {
        RowType: "Section",
        Title: "Bank",
        Rows: [{ RowType: "Row", Cells: [accountCell("Business Cheque", "bank-1"), { Value: String(bank) }] }],
      },
      {
        RowType: "Section",
        Title: "Current Liabilities",
        Rows: tax.map((t) => ({
          RowType: "Row",
          Cells: [accountCell(t.name, t.accountId), { Value: String(t.amount) }],
        })),
      },
    ],
  };
}

const FULL_TAX = [
  { name: "GST", amount: 40_000, accountId: "gst-1" },
  { name: "PAYG Withholding Payable", amount: 15_000, accountId: "payg-1" },
  { name: "Superannuation Payable", amount: 10_000, accountId: "super-1" },
];

const ACCOUNTS = {
  Accounts: [
    { AccountID: "bank-1", Name: "Business Cheque", Class: "ASSET", Status: "ACTIVE", Type: "BANK" },
    { AccountID: "gst-1", Name: "GST", Class: "LIABILITY", Status: "ACTIVE", SystemAccount: "GST" },
    { AccountID: "payg-1", Name: "PAYG Withholding Payable", Class: "LIABILITY", Status: "ACTIVE" },
    { AccountID: "super-1", Name: "Superannuation Payable", Class: "LIABILITY", Status: "ACTIVE" },
  ],
};

function accountRow(payload = ACCOUNTS) {
  return row({ report_key: "accounts", payload });
}

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
    const r = ruleProtectedMoneyVsCash(
      row({ report_key: "balance_sheet", payload: balanceSheet(50_000, FULL_TAX) }),
      accountRow(),
    );
    assert.ok(r.finding);
    assert.strictEqual(r.finding!.severity, "critical");
    assert.strictEqual(r.finding!.ruleId, "R01");
  });

  it("does not fire when protected money is well under cash", () => {
    const r = ruleProtectedMoneyVsCash(
      row({ report_key: "balance_sheet", payload: balanceSheet(500_000, FULL_TAX) }),
      accountRow(),
    );
    assert.strictEqual(r.finding, null);
    assert.strictEqual(r.unavailable, undefined);
  });

  it("never treats an unmatched component as zero", () => {
    // No superannuation account at all: the component is unresolved.
    const payload = balanceSheet(500_000, [
      { name: "GST", amount: 1_000, accountId: "gst-1" },
      { name: "PAYG Withholding Payable", amount: 500, accountId: "payg-1" },
    ]);
    const r = ruleProtectedMoneyVsCash(row({ report_key: "balance_sheet", payload }), accountRow());
    assert.strictEqual(r.finding, null);
    assert.match(r.unavailable ?? "", /super/);
  });

  it("does not fire when cash at bank is unknown", () => {
    // Bank accounts exist in the file but no Balance Sheet row matched them.
    const payload = {
      Rows: [
        {
          RowType: "Section",
          Title: "Current Liabilities",
          Rows: FULL_TAX.map((t) => ({
            RowType: "Row",
            Cells: [accountCell(t.name, t.accountId), { Value: String(t.amount) }],
          })),
        },
      ],
    };
    const r = ruleProtectedMoneyVsCash(row({ report_key: "balance_sheet", payload }), accountRow());
    assert.strictEqual(r.finding, null);
    assert.match(r.unavailable ?? "", /cash at bank/i);
  });

  it("does not fire when protected money is unknown", () => {
    const payload = balanceSheet(50_000, []);
    const r = ruleProtectedMoneyVsCash(row({ report_key: "balance_sheet", payload }), accountRow());
    assert.strictEqual(r.finding, null);
    assert.ok(r.unavailable);
  });

  it("does not fire when cash at bank is not a positive balance", () => {
    const r = ruleProtectedMoneyVsCash(
      row({ report_key: "balance_sheet", payload: balanceSheet(-10_000, FULL_TAX) }),
      accountRow(),
    );
    assert.strictEqual(r.finding, null);
    assert.match(r.unavailable ?? "", /not a positive balance/i);
  });
});

describe("cash at bank", () => {
  it("excludes a non-bank account and the section total", () => {
    const payload = {
      Rows: [
        {
          RowType: "Section",
          Title: "Bank",
          Rows: [
            { RowType: "Row", Cells: [accountCell("Business Cheque", "bank-1"), { Value: "50000" }] },
            { RowType: "Row", Cells: [accountCell("Loan account", "loan-1"), { Value: "-30000" }] },
            { RowType: "Row", Cells: [{ Value: "Total Bank" }, { Value: "20000" }] },
          ],
        },
      ],
    };
    const analysed = analyseBalanceSheet(payload, {
      Accounts: [
        ...ACCOUNTS.Accounts,
        { AccountID: "loan-1", Name: "Loan account", Class: "LIABILITY", Status: "ACTIVE", Type: "CURRLIAB" },
      ],
    });
    assert.strictEqual(analysed.cashAtBank.status, "assessed");
    if (analysed.cashAtBank.status !== "assessed") throw new Error("expected assessed cash");
    assert.strictEqual(analysed.cashAtBank.total, 50_000);
    assert.strictEqual(analysed.cashAtBank.accounts.length, 1);
  });

  it("finds bank accounts that are not under a section titled Bank", () => {
    const payload = {
      Rows: [
        {
          RowType: "Section",
          Title: "Current Assets",
          Rows: [{ RowType: "Row", Cells: [accountCell("Business Cheque", "bank-1"), { Value: "12345" }] }],
        },
      ],
    };
    const analysed = analyseBalanceSheet(payload, ACCOUNTS);
    assert.strictEqual(analysed.cashAtBank.status, "assessed");
    if (analysed.cashAtBank.status !== "assessed") throw new Error("expected assessed cash");
    assert.strictEqual(analysed.cashAtBank.total, 12_345);
  });

  it("reports unrecognised, not absent, when the file has bank accounts but no row matched", () => {
    const analysed = analyseBalanceSheet({ Rows: [] }, ACCOUNTS);
    assert.strictEqual(analysed.cashAtBank.status, "unrecognised");
  });

  it("reports absent only when the file has no active bank account", () => {
    const analysed = analyseBalanceSheet({ Rows: [] }, {
      Accounts: ACCOUNTS.Accounts.filter((a) => a.Type !== "BANK"),
    });
    assert.strictEqual(analysed.cashAtBank.status, "absent");
  });
});


describe("Balance Sheet extraction", () => {
  it("accepts the full Xero Reports envelope and extracts protected money and cash", () => {
    const inner = balanceSheet(50_000, FULL_TAX);
    const analysed = analyseBalanceSheet({ Reports: [inner] }, ACCOUNTS);
    assert.strictEqual(analysed.status, "assessed");
    assert.strictEqual(analysed.taxLines.status, "assessed");
    assert.strictEqual(analysed.cashAtBank.status, "assessed");
    if (analysed.taxLines.status !== "assessed" || analysed.cashAtBank.status !== "assessed") {
      throw new Error("expected assessed extraction");
    }
    assert.strictEqual(analysed.taxLines.lines.length, 3);
    assert.strictEqual(analysed.cashAtBank.total, 50_000);
  });

  it("accepts the inner report object", () => {
    const analysed = analyseBalanceSheet(balanceSheet(50_000, FULL_TAX), ACCOUNTS);
    assert.strictEqual(analysed.status, "assessed");
    assert.strictEqual(analysed.taxLines.status, "assessed");
  });

  it("returns input_invalid for malformed input instead of an empty extraction", () => {
    const analysed = analyseBalanceSheet({ notReports: [] }, ACCOUNTS);
    assert.strictEqual(analysed.status, "input_invalid");
    assert.strictEqual(analysed.taxLines.status, "input_invalid");
    assert.notStrictEqual(analysed.taxLines.status, "absent");
  });

  it("does not classify a GST-named bank account as protected money", () => {
    const analysed = analyseBalanceSheet(
      balanceSheet(80_000, [{ name: "GST and others Pty Ltd", amount: 12_000, accountId: "bank-2" }]),
      { Accounts: [{ AccountID: "bank-2", Name: "GST and others Pty Ltd", Class: "ASSET", Status: "ACTIVE", Type: "BANK" }] },
    );
    assert.strictEqual(analysed.taxLines.status, "absent");
  });

  it("does not treat Basil as BAS", () => {
    assert.strictEqual(
      classifyTaxLine("Loan - The Early Bird & Sweet Basil Pty Ltd", {
        AccountID: "loan-1",
        Name: "Loan - The Early Bird & Sweet Basil Pty Ltd",
        Class: "LIABILITY",
        Status: "ACTIVE",
      }),
      null,
    );
  });

  it("uses Xero SystemAccount=GST as authoritative", () => {
    assert.strictEqual(
      classifyTaxLine("ATO Clearing", {
        AccountID: "gst-1",
        Name: "ATO Clearing",
        Class: "LIABILITY",
        Status: "ACTIVE",
        SystemAccount: "GST",
      }),
      "gst",
    );
  });

  it("evaluates R01 through the snapshot path from envelope plus accounts snapshots", () => {
    const v = evaluateClient({
      clientId: "c1",
      connections: CONNECTED,
      snapshots: [
        row({ report_key: "balance_sheet", payload: { Reports: [balanceSheet(50_000, FULL_TAX)] } }),
        accountRow(),
        HEALTHY_DEBTORS,
      ],
      now: NOW,
    });
    assert.strictEqual(v.state, "issues");
    if (v.state !== "issues") throw new Error("expected issues verdict");
    assert.ok(v.findings.some((f) => f.ruleId === "R01"));
  });

  it("evaluates R01 through the live report path shape", () => {
    const v = evaluateFromRows(
      {
        clientId: "c1",
        connections: CONNECTED,
        snapshots: [
          row({ report_key: "balance_sheet", payload: { Reports: [balanceSheet(50_000, FULL_TAX)] } }),
          accountRow(),
          HEALTHY_DEBTORS,
        ],
        now: NOW,
      },
      { skipFreshness: true },
    );
    assert.strictEqual(v.state, "issues");
    if (v.state !== "issues") throw new Error("expected issues verdict");
    assert.ok(v.findings.some((f) => f.ruleId === "R01"));
  });
});

describe("R06 debtors", () => {
  it("does not fire on a truncated (complete = false) invoice payload", () => {
    const payload = invoicePayload([
      { due: 100_000, dueDate: "2020-01-01", contact: "Ancient Co" },
    ]);
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
  // Payables are part of full coverage: without them the lodged-and-owing half
  // of protected money is refused, which is a gap, not a green.
  const healthyPayables = row({ report_key: "invoices_accpay_open", payload: { Invoices: [] } });

  it("green only when everything is present, current and complete", () => {
    const v = evaluateClient({
      clientId: "c1",
      connections: CONNECTED,
      snapshots: [healthyBs, accountRow(), HEALTHY_DEBTORS, healthyPayables],
      now: NOW,
    });
    assert.strictEqual(v.state, "ok");
  });

  it("stale snapshots produce a stale state, never green", () => {
    const v = evaluateClient({
      clientId: "c1",
      connections: CONNECTED,
      snapshots: [{ ...healthyBs, fetched_at: OLD }, accountRow(), HEALTHY_DEBTORS],
      now: NOW,
    });
    assert.strictEqual(v.state, "stale");
  });

  it("a missing required key produces a partial state, never green", () => {
    const v = evaluateClient({
      clientId: "c1",
      connections: CONNECTED,
      snapshots: [healthyBs],
      now: NOW,
    });
    assert.strictEqual(v.state, "partial");
  });

  it("a wrong payload_version is treated as absent, never green", () => {
    const v = evaluateClient({
      clientId: "c1",
      connections: CONNECTED,
      snapshots: [{ ...healthyBs, payload_version: SNAPSHOT_PAYLOAD_VERSION + 1 }, accountRow(), HEALTHY_DEBTORS],
      now: NOW,
    });
    assert.strictEqual(v.state, "partial");
  });

  it("a disconnected Xero connection produces its own state, never green", () => {
    const v = evaluateClient({
      clientId: "c1",
      connections: [{ tenantId: "t1", status: "disconnected" }],
      snapshots: [healthyBs, accountRow(), HEALTHY_DEBTORS],
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
  const make = (
    ruleId: string,
    consequenceScore: number,
    daysToConsequence: number | null,
  ): Finding => ({
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

// ---------------------------------------------------------------------------
// R01 — lodged and still owing (the three-part figure)
//
// Lodging a BAS moves the amount off the Balance Sheet statutory accounts and
// into Accounts Payable as a bill to the ATO. Reading only the Balance Sheet
// therefore understates protected money at exactly the wrong moment.
// ---------------------------------------------------------------------------

function billsPayload(
  bills: {
    contact: string;
    date?: string;
    total: number;
    due: number;
    lines: { accountId: string; amount: number }[];
  }[],
) {
  return {
    Invoices: bills.map((b, i) => ({
      InvoiceID: `bill-${i}`,
      Type: "ACCPAY",
      Status: "AUTHORISED",
      Contact: { Name: b.contact },
      Date: b.date ?? "2026-08-05",
      Total: b.total,
      AmountDue: b.due,
      LineItems: b.lines.map((l) => ({
        AccountID: l.accountId,
        LineAmount: l.amount,
        TaxType: "BASEXCLUDED",
      })),
    })),
  };
}

function payablesRow(payload: any, complete = true) {
  return row({ report_key: "invoices_accpay_open", payload, complete });
}

const BS_ROW = row({ report_key: "balance_sheet", payload: balanceSheet(50_000, FULL_TAX) });

describe("R01 lodged and still owing", () => {
  it("bill pattern: adds the unpaid ATO bill coded to statutory accounts", () => {
    const r = ruleProtectedMoneyVsCash(
      BS_ROW,
      accountRow(),
      payablesRow(
        billsPayload([
          {
            contact: "Australian Taxation Office",
            total: 5_835,
            due: 5_835,
            lines: [
              { accountId: "gst-1", amount: 3_000 },
              { accountId: "payg-1", amount: 2_835 },
            ],
          },
        ]),
      ),
    );
    assert.strictEqual(r.split!.pattern, "bill");
    assert.strictEqual(Math.round(r.split!.lodgedOwing!), 5_835);
    assert.strictEqual(Math.round(r.split!.total!), 65_000 + 5_835);
    assert.strictEqual(r.splitGap, undefined);
  });

  it("a part-paid bill is scaled by its unpaid proportion", () => {
    // The July BAS: $5,835 raised, $4,835 paid, $1,000 outstanding. Without
    // scaling this counts at $5,835.
    const r = ruleProtectedMoneyVsCash(
      BS_ROW,
      accountRow(),
      payablesRow(
        billsPayload([
          {
            contact: "ATO",
            total: 5_835,
            due: 1_000,
            lines: [{ accountId: "gst-1", amount: 5_835 }],
          },
        ]),
      ),
    );
    assert.strictEqual(Math.round(r.split!.lodgedOwing!), 1_000);
  });

  it("a fully paid bill contributes nothing", () => {
    const r = ruleProtectedMoneyVsCash(
      BS_ROW,
      accountRow(),
      payablesRow(
        billsPayload([
          { contact: "ATO", total: 5_835, due: 0, lines: [{ accountId: "gst-1", amount: 5_835 }] },
        ]),
      ),
    );
    // No traceable contribution and no unpaid ATO bill: direct pattern.
    assert.strictEqual(r.split!.pattern, "direct");
    assert.strictEqual(r.split!.lodgedOwing, null);
    assert.strictEqual(r.split!.total, 65_000);
  });

  it("a bill dated after the period end is excluded", () => {
    const r = ruleProtectedMoneyVsCash(
      BS_ROW,
      accountRow(),
      payablesRow(
        billsPayload([
          {
            contact: "ATO",
            date: "2026-09-10",
            total: 4_000,
            due: 4_000,
            lines: [{ accountId: "gst-1", amount: 4_000 }],
          },
        ]),
      ),
    );
    assert.strictEqual(r.split!.pattern, "direct");
    assert.strictEqual(r.split!.total, 65_000);
  });

  it("no double counting: a bill already cleared off the Balance Sheet is counted once", () => {
    // The Balance Sheet carries only the new accrual; the lodged amount sits
    // in payables. Total must be the sum, not the sum plus the bill again.
    const bs = row({
      report_key: "balance_sheet",
      payload: balanceSheet(50_000, [{ name: "GST", amount: 7_480, accountId: "gst-1" }]),
    });
    const r = ruleProtectedMoneyVsCash(
      bs,
      accountRow(),
      payablesRow(
        billsPayload([
          { contact: "ATO", total: 5_835, due: 1_000, lines: [{ accountId: "gst-1", amount: 5_835 }] },
        ]),
      ),
    );
    assert.strictEqual(Math.round(r.split!.accruing), 7_480);
    assert.strictEqual(Math.round(r.split!.lodgedOwing!), 1_000);
    assert.strictEqual(Math.round(r.split!.total!), 8_480);
  });

  it("direct pattern: no ATO bills reports the Balance Sheet figure only", () => {
    const r = ruleProtectedMoneyVsCash(
      BS_ROW,
      accountRow(),
      payablesRow(
        billsPayload([
          { contact: "Bunnings", total: 500, due: 500, lines: [{ accountId: "other-1", amount: 500 }] },
        ]),
      ),
    );
    assert.strictEqual(r.split!.pattern, "direct");
    assert.strictEqual(r.split!.lodgedOwing, null);
    assert.strictEqual(r.splitGap, undefined);
  });

  it("clearing pattern refuses and suppresses the lodged and total lines", () => {
    const bs = row({
      report_key: "balance_sheet",
      payload: {
        Rows: [
          {
            RowType: "Section",
            Title: "Bank",
            Rows: [{ RowType: "Row", Cells: [accountCell("Business Cheque", "bank-1"), { Value: "50000" }] }],
          },
          {
            RowType: "Section",
            Title: "Current Liabilities",
            Rows: [
              ...FULL_TAX.map((t) => ({
                RowType: "Row",
                Cells: [accountCell(t.name, t.accountId), { Value: String(t.amount) }],
              })),
              // The suspense account carries a contra balance.
              { RowType: "Row", Cells: [accountCell("Suspense - ATO", "susp-1"), { Value: "-57000" }] },
            ],
          },
        ],
      },
    });
    const accounts = {
      Accounts: [
        ...ACCOUNTS.Accounts,
        { AccountID: "susp-1", Name: "Suspense - ATO", Class: "LIABILITY", Status: "ACTIVE" },
      ],
    };
    const r = ruleProtectedMoneyVsCash(
      bs,
      accountRow(accounts),
      payablesRow(
        billsPayload([
          { contact: "Australian Taxation Office", total: 30_773, due: 30_773, lines: [{ accountId: "susp-1", amount: 30_773 }] },
        ]),
      ),
    );
    assert.strictEqual(r.split!.pattern, "clearing");
    assert.strictEqual(r.split!.lodgedOwing, null, "must be suppressed, never zero");
    assert.strictEqual(r.split!.total, null, "must be suppressed, never zero");
    assert.match(r.splitGap ?? "", /not coded to the GST, PAYG withholding or superannuation accounts/);
  });

  it("untraceable ATO bills refuse", () => {
    const r = ruleProtectedMoneyVsCash(
      BS_ROW,
      accountRow(),
      payablesRow(
        billsPayload([
          { contact: "Australian Taxation Office", total: 9_000, due: 9_000, lines: [{ accountId: "other-1", amount: 9_000 }] },
        ]),
      ),
    );
    assert.strictEqual(r.split!.pattern, "untraceable");
    assert.strictEqual(r.split!.total, null);
    assert.match(r.splitGap ?? "", /unpaid bills to the ATO/);
  });

  it("a missing or truncated payables snapshot refuses", () => {
    const missing = ruleProtectedMoneyVsCash(BS_ROW, accountRow());
    assert.strictEqual(missing.split!.pattern, "unavailable");
    assert.strictEqual(missing.split!.total, null);
    assert.match(missing.splitGap ?? "", /unpaid supplier bills could not be read in full/);

    const truncated = ruleProtectedMoneyVsCash(
      BS_ROW,
      accountRow(),
      payablesRow(billsPayload([]), false),
    );
    assert.strictEqual(truncated.split!.pattern, "unavailable");
  });

  it("severity is unchanged by the split", () => {
    const without = ruleProtectedMoneyVsCash(BS_ROW, accountRow());
    const with_ = ruleProtectedMoneyVsCash(
      BS_ROW,
      accountRow(),
      payablesRow(
        billsPayload([
          { contact: "ATO", total: 50_000, due: 50_000, lines: [{ accountId: "gst-1", amount: 50_000 }] },
        ]),
      ),
    );
    assert.strictEqual(without.finding!.severity, with_.finding!.severity);
  });
});
