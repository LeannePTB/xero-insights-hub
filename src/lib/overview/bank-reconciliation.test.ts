import { describe, test } from "node:test";
import assert from "node:assert";
import { bankReconWarning, computeBankReconciliation, oldestReconciledTo, parseStored, statementPosition } from "./bank-reconciliation";

const asAt = "2026-10-11";
const acct = (id: string, name: string, extra: Record<string, string> = {}) => ({ AccountID: id, Name: name, Type: "BANK", BankAccountType: "BANK", Class: "ASSET", Status: "ACTIVE", ...extra });
const tx = (id: string, date: string) => ({ BankAccount: { AccountID: id }, Date: date, IsReconciled: false });
const done = (items: any[]) => ({ items, complete: true });

describe("bank reconciliation per account", () => {
  test("archived account is excluded", () => {
    const r = computeBankReconciliation({ accounts: [acct("a", "Westpac"), acct("z", "ANZ Credit Card Closed", { Status: "ARCHIVED" })], classifications: [], transactions: done([tx("z", "2026-08-01")]), payments: done([]), asAt });
    assert.deepStrictEqual(r?.accounts.map((a) => a.name), ["Westpac"]);
    assert.strictEqual(oldestReconciledTo(r), asAt);
  });
  test("account excluded in client settings is not checked", () => {
    const r = computeBankReconciliation({ accounts: [acct("a", "Westpac"), acct("b", "Old Savings")], classifications: [{ account_id: "b", classification: "excluded" }], transactions: done([tx("b", "2026-08-01")]), payments: done([]), asAt });
    assert.strictEqual(r?.scope, "selected");
    assert.deepStrictEqual(r?.accounts.map((a) => a.name), ["Westpac"]);
  });
  test("no saved settings uses all active bank accounts and says so", () => {
    const r = computeBankReconciliation({ accounts: [acct("a", "Westpac"), acct("c", "Card", { BankAccountType: "CREDITCARD" }), acct("x", "Closed", { Status: "ARCHIVED" })], classifications: [], transactions: done([tx("a", "2026-09-12")]), payments: done([]), asAt });
    assert.strictEqual(r?.scope, "all_active");
    assert.deepStrictEqual(r?.accounts.map((a) => a.name), ["Westpac"]);
    const w = bankReconWarning(r, asAt);
    assert.strictEqual(w?.text, "Westpac — not reconciled since 12 Sept (using all active bank accounts — choose accounts in client settings)");
  });
  test("old leftover line outside the 90-day window is ignored", () => {
    const r = computeBankReconciliation({ accounts: [acct("a", "Westpac")], classifications: [], transactions: done([tx("a", "2015-05-27"), tx("a", "2026-10-05")]), payments: done([]), asAt });
    assert.strictEqual(r?.accounts[0].reconciledTo, "2026-10-05");
    assert.strictEqual(bankReconWarning(r, asAt), null);
  });
  test("missing data gives no warning", () => {
    assert.strictEqual(computeBankReconciliation({ accounts: [acct("a", "Westpac")], classifications: [], transactions: null, payments: done([]), asAt }), null);
    assert.strictEqual(computeBankReconciliation({ accounts: [acct("a", "Westpac")], classifications: null, transactions: done([]), payments: done([]), asAt }), null);
    assert.strictEqual(bankReconWarning(null, asAt), null);
    assert.strictEqual(bankReconWarning({ scope: "selected", accounts: [{ accountId: "a", name: "W", reconciledTo: null }] }, asAt), null);
  });
  test("truncated pull leaves unseen accounts unknown, not reconciled", () => {
    const r = computeBankReconciliation({ accounts: [acct("a", "A"), acct("b", "B")], classifications: [], transactions: { items: [tx("a", "2026-09-01")], complete: false }, payments: done([]), asAt });
    assert.deepStrictEqual(r?.accounts.map((a) => a.reconciledTo), ["2026-09-01", null]);
  });
});

describe("statement position (reconciled bank position note)", () => {
  const txAmt = (id: string, date: string, type: string, total: number) => ({ BankAccount: { AccountID: id }, Date: date, IsReconciled: false, Type: type, Total: total });
  const pay = (id: string, date: string, amount: number) => ({ Account: { AccountID: id }, Date: date, IsReconciled: false, Amount: amount });

  test("spend is money out, receive is money in, payments are money out", () => {
    const r = computeBankReconciliation({
      accounts: [acct("a", "Westpac")],
      classifications: [],
      transactions: done([txAmt("a", "2026-10-01", "SPEND", 100), txAmt("a", "2026-10-02", "RECEIVE", 250)]),
      payments: done([pay("a", "2026-10-03", 40)]),
      asAt,
    });
    assert.strictEqual(r?.accounts[0].unreconciledNet, 110);
  });

  test("reconciled lines and out-of-window lines are not counted", () => {
    const r = computeBankReconciliation({
      accounts: [acct("a", "Westpac")],
      classifications: [],
      transactions: done([{ ...txAmt("a", "2026-10-01", "SPEND", 100), IsReconciled: true }, txAmt("a", "2015-05-27", "SPEND", 999)]),
      payments: done([]),
      asAt,
    });
    assert.strictEqual(r?.accounts[0].unreconciledNet, 0);
  });

  test("statement position takes unreconciled lines back out of the ledger figure", () => {
    // Demo Company shape: ledger -5145, unreconciled net -13472.70 -> reconciled 8327.70.
    const r = computeBankReconciliation({
      accounts: [acct("a", "Business Bank"), acct("b", "Savings")],
      classifications: [],
      transactions: done([txAmt("a", "2026-10-01", "SPEND", 13472.7)]),
      payments: done([]),
      asAt,
    });
    const pos = statementPosition(r, -5145);
    assert.ok(pos);
    assert.strictEqual(Math.round(pos!.reconciled * 100) / 100, 8327.7);
    assert.strictEqual(Math.round(pos!.unreconciled * 100) / 100, -13472.7);
  });

  test("no note when the pull was incomplete, the ledger figure is missing, or the difference is nil", () => {
    const partial = computeBankReconciliation({
      accounts: [acct("a", "A")],
      classifications: [],
      transactions: { items: [txAmt("a", "2026-10-01", "SPEND", 100)], complete: false },
      payments: done([]),
      asAt,
    });
    assert.strictEqual(partial?.accounts[0].unreconciledNet, null);
    assert.strictEqual(statementPosition(partial, 500), null);
    assert.strictEqual(statementPosition(null, 500), null);
    const settled = computeBankReconciliation({ accounts: [acct("a", "A")], classifications: [], transactions: done([]), payments: done([]), asAt });
    assert.strictEqual(statementPosition(settled, 500), null);
    assert.strictEqual(statementPosition(settled, null), null);
  });

  test("stored JSON round-trips with the new field and rejects bad shapes", () => {
    const r = computeBankReconciliation({ accounts: [acct("a", "A")], classifications: [], transactions: done([txAmt("a", "2026-10-01", "SPEND", 100)]), payments: done([]), asAt });
    assert.strictEqual(parseStored(JSON.parse(JSON.stringify(r)))?.accounts[0].unreconciledNet, -100);
    assert.strictEqual(parseStored({ scope: "selected", windowFrom: "2026-07-13", accounts: [{ accountId: "a", name: "A", reconciledTo: null, unreconciledNet: "lots" }] }), null);
  });
});
