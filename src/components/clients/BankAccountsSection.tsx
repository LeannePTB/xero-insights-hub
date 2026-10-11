import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { listBankAccounts, saveBankAccount } from '@/lib/bank-accounts.functions';
import type { BankClassification } from '@/lib/xero/bank-classifications';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export function BankAccountsSection({ clientId, tenantId }: { clientId: string; tenantId: string }) {
  const list = useServerFn(listBankAccounts);
  const save = useServerFn(saveBankAccount);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['bank-classifications', clientId, tenantId], queryFn: () => list({ data: { clientId, tenantId } }) });
  const mutation = useMutation({ mutationFn: ({ accountId, classification }: { accountId: string; classification: BankClassification | null }) => save({ data: { clientId, tenantId, accountId, classification } }), onSuccess: async () => { await qc.invalidateQueries(); toast.success('Account classification saved'); }, onError: (error: Error) => toast.error(error.message) });
  if (query.isPending) return <p className="text-sm text-muted-foreground">Reading saved accounts…</p>;
  if (query.error) return <p className="text-sm text-destructive">{query.error.message}</p>;
  return <div className="space-y-3">{query.data.rows.length === 0 ? <p className="text-sm text-muted-foreground">No active bank accounts.</p> : query.data.rows.map(row => <div key={row.accountId} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-2"><div className="min-w-0"><p className="text-sm font-medium break-words">{row.name}</p><p className="text-xs text-muted-foreground">Xero: {row.detected === 'credit_card' ? 'Credit card' : 'Bank account'}</p></div><Select value={row.stored ?? 'xero'} disabled={mutation.isPending} onValueChange={value => mutation.mutate({ accountId: row.accountId, classification: value === 'xero' ? null : value as BankClassification })}><SelectTrigger aria-label={`Classification for ${row.name}`} className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="xero">Use Xero classification</SelectItem><SelectItem value="bank">Bank account</SelectItem><SelectItem value="credit_card">Credit card</SelectItem></SelectContent></Select></div>)}</div>;
}