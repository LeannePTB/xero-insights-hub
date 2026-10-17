import { describe, expect, it } from 'vitest';
import { groupedCardIds, canReorderCards, standardFallbackCards, dashboardCardMeta, orderedCardIds, smallCardRowSizes } from '../src/components/dashboard/dashboard-card-layout';
import type { CardCatalogue } from '../src/lib/cards/catalogue';

const catalogue: CardCatalogue = {
  modules: [{ key: 'profit', label: 'Profit', description: '' }],
  cards: [
    ...['payables', 'receivables', 'pnl', 'health'].map(key => ({ key, package: 'standard' as const, module: null, label: key, description: '' })),
    { key: 'accounting_breakeven', package: 'advisory', module: 'profit', label: 'Breaking even', description: '' },
  ],
};

describe('dashboard catalogue ordering', () => {
  it('fixes Tax obligations, GST, PAYG and Super order despite the September saved order', () => {
    const keys = ['gst_reconciliation', 'superannuation', 'payg_withholding', 'tax_obligations'];
    const cat: CardCatalogue = { modules: [{ key: 'tax_compliance', label: 'Tax & compliance', description: '' }], cards: keys.map(key => ({ key, package: 'advisory', module: 'tax_compliance', label: key, description: '' })) };
    const cards = keys.map(key => ({ id: `file:${key}`, group: 'tax_compliance' })).sort((a,b) => dashboardCardMeta(a.id, cat).rank - dashboardCardMeta(b.id,cat).rank);
    // Default: obligations full width; GST + PAYG side by side; super full width.
    expect(groupedCardIds(cards, [])).toEqual(['file:tax_obligations','file:gst_reconciliation','file:payg_withholding','file:superannuation']);
    expect(dashboardCardMeta('file:tax_obligations',cat).fullWidth).toBe(true);
    expect(dashboardCardMeta('file:superannuation',cat).fullWidth).toBe(true);
    expect(dashboardCardMeta('file:gst_reconciliation',cat).fullWidth).toBe(false);
    expect(dashboardCardMeta('file:payg_withholding',cat).fullWidth).toBe(false);
    expect(groupedCardIds(cards, ['file:gst_reconciliation','file:superannuation','file:payg_withholding'])).toEqual(['file:tax_obligations','file:gst_reconciliation','file:payg_withholding','file:superannuation']);
    const explicit = ['file:payg_withholding','file:tax_obligations','file:gst_reconciliation','file:superannuation'];
    expect(groupedCardIds(cards, explicit)).toEqual(['file:tax_obligations','file:gst_reconciliation','file:payg_withholding','file:superannuation']);
    expect(explicit).toEqual(['file:payg_withholding','file:tax_obligations','file:gst_reconciliation','file:superannuation']);
  });
  it('keeps only visible tax cards and preserves saved order elsewhere', () => {
    const cards = [{ id: 'pnl', group: 'standard' }, { id: 'receivables', group: 'standard' },
      ...['superannuation', 'payg_withholding', 'tax_obligations'].map(id => ({ id, group: 'tax_compliance' }))];
    expect(groupedCardIds(cards, ['receivables','pnl','superannuation','payg_withholding'])).toEqual(['receivables','pnl','tax_obligations','payg_withholding','superannuation']);
  });
  it('refuses any dragging inside Tax & compliance', () => {
    const cards = ['tax_obligations','gst_reconciliation','payg_withholding','superannuation'].map(id => ({ id, group: 'tax_compliance' }));
    for (const source of cards) for (const target of cards) {
      expect(canReorderCards(cards, source.id, target.id)).toBe(false);
    }
  });
  it('groups all saved module permutations once in the incoming order without changing saved data', () => {
    const GROUP_ORDER = ['standard', 'tax_compliance', 'profit', 'cash_flow', 'bookkeeping_checks', 'rental_properties', 'consolidation'];
    const cards = GROUP_ORDER.flatMap(group => [{ id: `${group}:a`, group }, { id: `${group}:b`, group }]);
    const permutations = (items: string[]): string[][] => items.length === 0 ? [[]] : items.flatMap((item, index) => permutations(items.filter((_, i) => i !== index)).map(rest => [item, ...rest]));
    for (const permutation of permutations([...GROUP_ORDER])) {
      const saved = permutation.flatMap(group => [`${group}:b`, `${group}:a`]);
      const ordered = groupedCardIds(cards, saved);
      const headings = ordered.map(id => cards.find(c => c.id === id)?.group).filter((group, i, all) => i === 0 || group !== all[i - 1]);
      expect(headings).toEqual(GROUP_ORDER);
      expect(ordered).toEqual(GROUP_ORDER.flatMap(group => [`${group}:b`, `${group}:a`]));
      expect(saved).toEqual(permutation.flatMap(group => [`${group}:b`, `${group}:a`]));
    }
  });
  it('orders Advisory module sections by card_modules.sort_order (catalogue order)', () => {
    const mods = (keys: string[]) => keys.map(key => ({ key, label: key, description: '' }));
    const cards = [
      { key: 'cashflow', package: 'advisory' as const, module: 'cash_flow', label: '', description: '' },
      { key: 'accounting_breakeven', package: 'advisory' as const, module: 'profit', label: '', description: '' },
      { key: 'tax_obligations', package: 'advisory' as const, module: 'tax_compliance', label: '', description: '' },
    ];
    const order = (keys: string[]) => {
      const cat: CardCatalogue = { modules: mods(keys), cards };
      return cards.map(c => c.key).sort((a, b) => dashboardCardMeta(a, cat).groupRank - dashboardCardMeta(b, cat).groupRank).map(k => dashboardCardMeta(k, cat).group);
    };
    expect(order(['tax_compliance', 'profit', 'cash_flow'])).toEqual(['tax_compliance', 'profit', 'cash_flow']);
    expect(order(['cash_flow', 'tax_compliance', 'profit'])).toEqual(['cash_flow', 'tax_compliance', 'profit']);
  });
  it('refuses cross-module dragging but accepts within-module dragging', () => {
    const cards = [{ id: 'health', group: 'standard' }, { id: 'notes', group: 'standard' }, { id: 'cashflow', group: 'cash_flow' }];
    expect(canReorderCards(cards, 'health', 'cashflow')).toBe(false);
    expect(canReorderCards(cards, 'health', 'notes')).toBe(true);
    expect(canReorderCards(cards, 'missing', 'notes')).toBe(false);
  });
  it('orders Standard health, P&L, receivables, payables (Notes retired, ranked last)', () => {
    const keys = catalogue.cards.filter(c => c.package === 'standard').map(c => c.key);
    expect(keys.sort((a,b) => dashboardCardMeta(a,catalogue).rank - dashboardCardMeta(b,catalogue).rank)).toEqual(['health','pnl','receivables','payables']);
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
    expect(standardFallbackCards(ids).map(c => c.id)).toEqual(['health','t1:pnl','t1:receivables']);
  });
});
