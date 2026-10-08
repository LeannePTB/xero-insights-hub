import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyseBalanceSheet } from "./tax-lines";

function balances(cardBalance: number, cardStatus = "ACTIVE") {
  const accounts = { Accounts: [
    { AccountID: "bank", Type: "BANK", Class: "ASSET", BankAccountType: "BANK", Status: "ACTIVE" },
    { AccountID: "card", Type: "BANK", Class: "ASSET", BankAccountType: "CREDITCARD", Status: cardStatus },
  ] };
  const report = { Rows: [{ RowType: "Section", Rows: [
    { RowType: "Row", Cells: [{ Value: "Transaction account", Attributes: [{ Id: "account", Value: "bank" }] }, { Value: "50000" }] },
    { RowType: "Row", Cells: [{ Value: "Payment account", Attributes: [{ Id: "account", Value: "card" }] }, { Value: String(cardBalance) }] },
  ] }] };
  return analyseBalanceSheet(report, accounts);
}

describe("cash at bank and net cash", () => {
  it("cash at bank is bank money only, excluding asset-class credit cards", () => {
    const result = balances(-20000);
    assert.equal(result.cashAtBank.status, "assessed");
    assert.equal(result.cashAtBank.total, 50000);
  });
  it("net cash is bank money less credit-card debt, deducted exactly once", () => {
    const result = balances(-20000);
    assert.equal(result.creditCardDebt.status, "assessed");
    assert.equal(result.creditCardDebt.total, 20000);
    assert.equal(result.cashAtBank.total - result.creditCardDebt.total, 30000);
  });
  it("an overpaid card neither increases bank cash nor creates debt", () => {
    const result = balances(5000);
    assert.equal(result.cashAtBank.total, 50000);
    assert.equal(result.creditCardDebt.total, 0);
  });
  it("an archived card is excluded from both balances", () => {
    const result = balances(-20000, "ARCHIVED");
    assert.equal(result.cashAtBank.total, 50000);
    assert.equal(result.creditCardDebt.status, "absent");
    assert.equal(result.creditCardDebt.total, 0);
  });
  it("a card shown under Current Liabilities with a positive balance is debt owed", () => {
    const accounts = { Accounts: [
      { AccountID: "bank", Type: "BANK", Class: "ASSET", BankAccountType: "BANK", Status: "ACTIVE" },
      { AccountID: "card", Type: "BANK", Class: "ASSET", BankAccountType: "CREDITCARD", Status: "ACTIVE" },
    ] };
    const report = { Rows: [
      { RowType: "Section", Title: "Bank", Rows: [
        { RowType: "Row", Cells: [{ Value: "Transaction account", Attributes: [{ Id: "account", Value: "bank" }] }, { Value: "21784" }] },
      ] },
      { RowType: "Section", Title: "Current Liabilities", Rows: [
        { RowType: "Row", Cells: [{ Value: "Amex", Attributes: [{ Id: "account", Value: "card" }] }, { Value: "14896.69" }] },
      ] },
    ] };
    const result = analyseBalanceSheet(report, accounts);
    assert.equal(result.cashAtBank.total, 21784);
    assert.equal(result.creditCardDebt.total, 14896.69);
  });
});
