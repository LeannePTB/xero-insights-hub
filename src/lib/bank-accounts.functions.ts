import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireAal2 } from '@/lib/auth/require-aal2';
import type { BankClassification } from '@/lib/xero/bank-classifications';

const scope = z.object({ clientId: z.string().uuid(), tenantId: z.string().min(1).max(200) });
export const listBankAccounts = createServerFn({ method: 'POST' }).middleware([requireAal2])
  .inputValidator(input => scope.parse(input)).handler(async ({ data, context }) => {
    const { error: ownershipError } = await context.supabase.rpc('assert_tenant_belongs_to_client', { _client_id: data.clientId, _tenant_id: data.tenantId });
    if (ownershipError) throw new Error('Accounts unavailable.');
    const [snapshot, choices] = await Promise.all([
      context.supabase.from('xero_snapshots').select('payload, fetched_at').eq('client_id', data.clientId).eq('tenant_id', data.tenantId).eq('report_key', 'accounts').eq('complete', true).order('fetched_at', { ascending: false }).limit(1).maybeSingle(),
      context.supabase.from('client_bank_account_classifications').select('account_id, classification').eq('client_id', data.clientId).eq('tenant_id', data.tenantId),
    ]);
    if (snapshot.error || choices.error || !snapshot.data) throw new Error('Saved accounts are unavailable.');
    const payload = snapshot.data.payload as { Accounts?: { AccountID: string; Name: string; Type: string; Class: string; Status: string; BankAccountType?: string }[] };
    const stored = new Map((choices.data ?? []).map(row => [row.account_id, row.classification as BankClassification]));
    const { logClientDataRead } = await import('@/lib/audit.server');
    logClientDataRead({ actorUserId: context.userId, clientId: data.clientId, tenantId: data.tenantId, readKey: 'bank_account_classifications', source: 'snapshot' });
    return { rows: (payload.Accounts ?? []).filter(a => a.Type === 'BANK' && a.Status === 'ACTIVE').map(a => ({ accountId: a.AccountID, name: a.Name, detected: a.BankAccountType === 'CREDITCARD' || a.Class === 'LIABILITY' ? 'credit_card' : 'bank', stored: stored.get(a.AccountID) ?? null })) };
  });

export const saveBankAccount = createServerFn({ method: 'POST' }).middleware([requireAal2])
  .inputValidator(input => scope.extend({ accountId: z.string().uuid(), classification: z.enum(['bank', 'credit_card', 'excluded']).nullable() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('save_client_bank_account_classification', { _client_id: data.clientId, _tenant_id: data.tenantId, _account_id: data.accountId, _classification: data.classification as string });
    if (error) throw new Error('The account classification could not be saved.');
    return { ok: true };
  });