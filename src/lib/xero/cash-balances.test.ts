import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyseBalanceSheet } from "./tax-lines";
import { applyBankClassifications, balanceSheetBankBalances } from './bank-classifications';

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
  it('explicit account-ID classification produces the requested cash and net cash without changing Xero', () => {
    const accounts = { Accounts: ['astro', 'gst', 'card'].map(AccountID => ({ AccountID, Type: 'BANK', BankAccountType: 'BANK', Class: 'ASSET', Status: 'ACTIVE' })) };
    const report = { Rows: [{ RowType: 'Section', Rows: [
      ...[['astro', '2444.85'], ['gst', '2000'], ['card', '-3554.32']].map(([id, value]) => ({ RowType: 'Row', Cells: [{ Value: 'Same name', Attributes: [{ Id: 'account', Value: id }] }, { Value: value }] })),
      { RowType: 'SummaryRow', Cells: [{ Value: 'Total Bank' }, { Value: '890.53' }] },
    ] }] };
    const result = analyseBalanceSheet(report, accounts, undefined, [{ account_id: 'CARD', classification: 'credit_card' }]);
    assert.equal(result.cashAtBank.total, 4444.85);
    assert.equal(result.creditCardDebt.total, 3554.32);
    assert.equal(Math.round((result.cashAtBank.total - result.creditCardDebt.total) * 100), 89053);
    assert.equal(accounts.Accounts[2].BankAccountType, 'BANK');
    assert.equal(Math.round(analyseBalanceSheet(report, accounts).cashAtBank.total * 100), 89053);
    assert.equal(balanceSheetBankBalances(report).get('card'), -3554.32);
  });
  it('excluded accounts are left out of both cash at bank and credit-card debt', () => {
    const accounts = { Accounts: ['astro', 'gst', 'card'].map(AccountID => ({ AccountID, Type: 'BANK', BankAccountType: 'BANK', Class: 'ASSET', Status: 'ACTIVE' })) };
    const report = { Rows: [{ RowType: 'Section', Rows: [
      ...[['astro', '2444.85'], ['gst', '2000'], ['card', '-3554.32']].map(([id, value]) => ({ RowType: 'Row', Cells: [{ Value: 'Same name', Attributes: [{ Id: 'account', Value: id }] }, { Value: value }] })),
    ] }] };
    const result = analyseBalanceSheet(report, accounts, undefined, [{ account_id: 'gst', classification: 'excluded' }]);
    assert.equal(result.cashAtBank.total, 2444.85);
    assert.equal(result.creditCardDebt.total, 0);
    const overlay = applyBankClassifications(accounts.Accounts, [{ account_id: 'GST', classification: 'excluded' }]);
    assert.equal(overlay.some(account => account.AccountID === 'gst'), false);
  });
  it('does not guess from names, negative balances or unknown IDs; reset restores Xero', () => {
    const accounts = [{ AccountID: 'bank', Name: 'Credit Card', Type: 'BANK', BankAccountType: 'BANK', Class: 'ASSET', Status: 'ACTIVE' }];
    assert.equal(applyBankClassifications(accounts, [ { account_id: 'unknown', classification: 'credit_card' } ])[0].BankAccountType, 'BANK');
    assert.equal(applyBankClassifications(accounts, [ { account_id: 'bank', classification: 'credit_card' } ])[0].BankAccountType, 'CREDITCARD');
    assert.equal(applyBankClassifications(accounts, [])[0].BankAccountType, 'BANK');
    assert.equal(applyBankClassifications([{ ...accounts[0], Status: 'ARCHIVED' }], [ { account_id: 'bank', classification: 'credit_card' } ])[0].BankAccountType, 'BANK');
  });
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
