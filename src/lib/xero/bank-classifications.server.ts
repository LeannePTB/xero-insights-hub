import { applyBankClassifications, type BankClassificationRow } from './bank-classifications';

/** Caller client, or the already-registered nightly system client. Errors never become empty overrides. */
export async function classifiedAccounts(supabase: any, tenantId: string, payload: any, clientId?: string) {
  if (!clientId) {
    const { data: links, error: linkError } = await supabase.from('client_xero_orgs').select('client_id').eq('tenant_id', tenantId);
    const ids = [...new Set((links ?? []).map((link: any) => link.client_id))];
    if (linkError || ids.length !== 1) throw new Error('The client for these bank accounts could not be resolved.');
    clientId = ids[0] as string;
  }
  const query = supabase.from('client_bank_account_classifications').select('account_id, classification').eq('tenant_id', tenantId).eq('client_id', clientId);
  const { data, error } = await query;
  if (error) throw new Error('Bank account classifications could not be read.');
  if (!Array.isArray(payload?.Accounts)) return payload;
  return { ...payload, Accounts: applyBankClassifications(payload.Accounts, (data ?? []) as BankClassificationRow[]) };
}