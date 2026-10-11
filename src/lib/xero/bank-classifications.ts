import type { XeroAccountRef } from './tax-lines';

export type BankClassification = 'bank' | 'credit_card';
export type BankClassificationRow = { account_id: string; classification: BankClassification };

/** ID-keyed metadata overlay; never mutates Xero's payload or matches names. */
export function applyBankClassifications<T extends XeroAccountRef>(accounts: T[], rows: BankClassificationRow[]): T[] {
  const byId = new Map(rows.map(row => [row.account_id.toLowerCase(), row.classification]));
  return accounts.map(account => {
    const choice = byId.get(String(account.AccountID ?? '').toLowerCase());
    if (!choice || account.Type?.toUpperCase() !== 'BANK' || account.Status?.toUpperCase() !== 'ACTIVE') return account;
    return { ...account, BankAccountType: choice === 'credit_card' ? 'CREDITCARD' : 'BANK', Class: 'ASSET' };
  });
}