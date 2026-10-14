import type { HistoryRow } from './history';
/** Caller client only; bounded six/twelve-month pages. Never privileged. */
export async function readFigureHistory(sb: any, ids: string[], from: string, to: string, tenantId?: string): Promise<HistoryRow[]> {
  const out: HistoryRow[] = [];
  for (let i = 0; i < ids.length; i += 25) {
    for (let offset = 0; offset < 25000; offset += 1000) {
      let query = sb.from('client_key_figures').select('client_id, tenant_id, as_at, cash, protected_money')
        .in('client_id', ids.slice(i, i + 25)).gte('as_at', from).lte('as_at', to)
        .order('as_at').order('client_id').order('tenant_id').range(offset, offset + 999);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { data, error } = await query;
      if (error) throw new Error('Stored figure history could not be read.');
      out.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
      if (offset === 24000) throw new Error('Stored history exceeds the bounded chart window.');
    }
  }
  return out;
}
