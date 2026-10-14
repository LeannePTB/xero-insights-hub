import { describe, expect, it } from 'bun:test';
import { dashboardCardMeta, orderedCardIds, smallCardRowSizes } from './dashboard-card-layout';
import type { CardCatalogue } from '@/lib/cards/catalogue';

const catalogue: CardCatalogue = {
  modules: [{ key: 'profit', label: 'Profit', description: '' }],
  cards: [
    ...['notes', 'payables', 'receivables', 'pnl', 'health'].map(key => ({ key, package: 'standard' as const, module: null, label: key, description: '' })),
    { key: 'accounting_breakeven', package: 'advisory', module: 'profit', label: 'Breaking even', description: '' },
  ],
};

describe('dashboard catalogue ordering', () => {
  it('orders Standard health, P&L, receivables, payables, then Notes', () => {
    const keys = catalogue.cards.filter(c => c.package === 'standard').map(c => c.key);
    expect(keys.sort((a,b) => dashboardCardMeta(a,catalogue).rank - dashboardCardMeta(b,catalogue).rank)).toEqual(['health','pnl','receivables','payables','notes']);
  });
  it('uses the catalogue module rather than an Advisory catch-all', () => {
    expect(dashboardCardMeta('file:accounting_breakeven',catalogue).group).toBe('profit');
  });
  it('preserves the user’s order and removes unknown/duplicate card IDs', () => {
    expect(orderedCardIds(['health','pnl','notes'],['notes','health','unknown','notes'])).toEqual(['notes','health','pnl']);
  });
  it('balances four small cards as two pairs and five as a triple plus pair', () => {
    expect(smallCardRowSizes(4)).toEqual([2,2]);
    expect(smallCardRowSizes(5)).toEqual([3,2]);
    expect(smallCardRowSizes(7)).toEqual([2,3,2]);
  });
});