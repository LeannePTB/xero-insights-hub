import { describe, test } from "bun:test";
import assert from "node:assert";
import { bankReconWarning, computeBankReconciliation, oldestReconciledTo } from "./bank-reconciliation";

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
