import type { XeroAccountRef } from './tax-lines';

export type BankClassification = 'bank' | 'credit_card';
export type BankClassificationRow = { account_id: string; classification: BankClassification };

/** Account-row balances only; summary rows never have an account ID. */
export function balanceSheetBankBalances(payload: any): Map<string, number> {
  const balances = new Map<string, number>();
  const walk = (rows: any[]) => {
    for (const row of rows) {
      if (row.RowType === 'Row') {
        const id = (row.Cells ?? []).flatMap((cell: any) => cell.Attributes ?? []).find((attr: any) => attr.Id === 'account')?.Value;
        const raw = String(row.Cells?.[1]?.Value ?? '').replace(/,/g, '');
        const value = Number(raw);
        if (id && Number.isFinite(value)) balances.set(String(id).toLowerCase(), value);
      }
      if (Array.isArray(row.Rows)) walk(row.Rows);
    }
  };
  walk(payload?.Reports?.[0]?.Rows ?? payload?.Rows ?? []);
  return balances;
}

/** ID-keyed metadata overlay; never mutates Xero's payload or matches names. */
export function applyBankClassifications<T extends XeroAccountRef>(accounts: T[], rows: BankClassificationRow[]): T[] {
  const byId = new Map(rows.map(row => [row.account_id.toLowerCase(), row.classification]));
  return accounts.map(account => {
    const choice = byId.get(String(account.AccountID ?? '').toLowerCase());
    if (!choice || account.Type?.toUpperCase() !== 'BANK' || account.Status?.toUpperCase() !== 'ACTIVE') return account;
    return { ...account, BankAccountType: choice === 'credit_card' ? 'CREDITCARD' : 'BANK', Class: 'ASSET' };
  });
}