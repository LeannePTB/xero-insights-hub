import { describe, expect, it } from 'vitest';
import { GROUP_ORDER, groupedCardIds, canReorderCards, standardFallbackCards, dashboardCardMeta, orderedCardIds, smallCardRowSizes } from '../src/components/dashboard/dashboard-card-layout';
import type { CardCatalogue } from '../src/lib/cards/catalogue';

const catalogue: CardCatalogue = {
  modules: [{ key: 'profit', label: 'Profit', description: '' }],
  cards: [
    ...['notes', 'payables', 'receivables', 'pnl', 'health'].map(key => ({ key, package: 'standard' as const, module: null, label: key, description: '' })),
    { key: 'accounting_breakeven', package: 'advisory', module: 'profit', label: 'Breaking even', description: '' },
  ],
};

describe('dashboard catalogue ordering', () => {
  it('groups all saved module permutations once in fixed order without changing saved data', () => {
    const cards = GROUP_ORDER.flatMap(group => [{ id: `${group}:a`, group }, { id: `${group}:b`, group }]);
    const permutations = (items: string[]): string[][] => items.length === 0 ? [[]] : items.flatMap((item, index) => permutations(items.filter((_, i) => i !== index)).map(rest => [item, ...rest]));
    for (const permutation of permutations([...GROUP_ORDER])) {
      const saved = permutation.flatMap(group => [`${group}:b`, `${group}:a`]);
      const ordered = groupedCardIds(cards, saved);
      const headings = ordered.map(id => cards.find(c => c.id === id)?.group).filter((group, i, all) => i === 0 || group !== all[i - 1]);
      expect(headings).toEqual(['standard', 'cash_flow', 'profit', 'tax_compliance', 'bookkeeping_checks', 'consolidation']);
      expect(ordered).toEqual(GROUP_ORDER.flatMap(group => [`${group}:b`, `${group}:a`]));
      expect(saved).toEqual(permutation.flatMap(group => [`${group}:b`, `${group}:a`]));
    }
  });
  it('refuses cross-module dragging but accepts within-module dragging', () => {
    const cards = [{ id: 'health', group: 'standard' }, { id: 'notes', group: 'standard' }, { id: 'cashflow', group: 'cash_flow' }];
    expect(canReorderCards(cards, 'health', 'cashflow')).toBe(false);
    expect(canReorderCards(cards, 'health', 'notes')).toBe(true);
    expect(canReorderCards(cards, 'missing', 'notes')).toBe(false);
  });
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
  it('falls back to Standard cards in default order when the catalogue is unavailable', () => {
    const ids = ['t1:xero_audit','notes','t1:pnl','health','t1:cashflow','t1:receivables'].map(id => ({ id }));
    expect(standardFallbackCards(ids).map(c => c.id)).toEqual(['health','t1:pnl','t1:receivables','notes']);
  });
});
