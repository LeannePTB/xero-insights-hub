import { applyBankClassifications, type BankClassificationRow } from './bank-classifications';

/** Caller client, or the already-registered nightly system client. Errors never become empty overrides. */
export async function classifiedAccounts(supabase: any, tenantId: string, payload: any, clientId?: string) {
  let query = supabase.from('client_bank_account_classifications').select('account_id, classification').eq('tenant_id', tenantId);
  if (clientId) query = query.eq('client_id', clientId);
  const { data, error } = await query;
  if (error) throw new Error('Bank account classifications could not be read.');
  if (!Array.isArray(payload?.Accounts)) throw new Error('Bank account metadata is unavailable.');
  return { ...payload, Accounts: applyBankClassifications(payload.Accounts, (data ?? []) as BankClassificationRow[]) };
}