import type { CardCatalogue } from '@/lib/cards/catalogue';

// Presentation only: callers pass the cards already granted by the database.
export const MODULE_ORDER = ['cash_flow', 'profit', 'tax_compliance', 'bookkeeping_checks', 'rental_properties'];
export const GROUP_ORDER = ['standard', ...MODULE_ORDER, 'consolidation'];
export const STANDARD_ORDER = ['health', 'pnl', 'receivables', 'payables', 'notes'];
const WIDE_CARDS = new Set(['health', 'pnl', 'cashflow', 'cashflow_scenario', 'accounting_breakeven', 'transaction_search', 'gst_reconciliation', 'notes', 'loan_consolidation']);

export function dashboardCardMeta(id: string, catalogue: CardCatalogue) {
  const key = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
  const card = catalogue.cards.find(c => c.key === key);
  const group = card?.package === 'advisory' ? card.module : card?.package;
  return {
    key,
    group: group ?? 'standard',
    label: card?.package === 'advisory'
      ? catalogue.modules.find(m => m.key === card.module)?.label ?? 'Advisory'
      : card?.package === 'consolidation' ? 'Consolidation' : 'Standard',
    rank: card?.package === 'standard' ? STANDARD_ORDER.indexOf(key) : catalogue.cards.findIndex(c => c.key === key),
    groupRank: group === 'standard' ? 0 : group === 'consolidation' ? 1 + MODULE_ORDER.length : 1 + MODULE_ORDER.indexOf(group ?? ''),
    fullWidth: WIDE_CARDS.has(key),
  };
}

export function dashboardPackageSummary(catalogue: CardCatalogue, visible: readonly string[]) {
  const advisory = catalogue.cards.filter(c => c.package === 'advisory' && visible.includes(c.key));
  const modules = MODULE_ORDER.flatMap(key => {
    const m = catalogue.modules.find(m => m.key === key);
    return m && advisory.some(c => c.module === key) ? [m.label] : [];
  });
  const consolidation = catalogue.cards.some(c => c.package === 'consolidation' && visible.includes(c.key));
  return `Standard${advisory.length ? ` + Advisory${modules.length ? ` (${modules.join(', ')})` : ''}` : ''}${consolidation ? ' + Consolidation' : ''}`;
}

export function orderedCardIds(ids: readonly string[], saved: readonly string[]) {
  const known = new Set(ids);
  const custom = [...new Set(saved)].filter(id => known.has(id));
  return [...custom, ...ids.filter(id => !custom.includes(id))];
}

/** Saved preferences reorder within modules, never between them. */
export function groupedCardIds(cards: readonly { id: string; group?: string }[], saved: readonly string[]) {
  const groups = new Map(cards.map(c => [c.id, c.group ?? 'cards']));
  const rank = (id: string) => {
    const index = GROUP_ORDER.indexOf(groups.get(id) ?? 'cards');
    return index < 0 ? GROUP_ORDER.length : index;
  };
  return orderedCardIds(cards.map(c => c.id), saved).sort((a, b) => rank(a) - rank(b));
}

export function canReorderCards(cards: readonly { id: string; group?: string }[], active: string, over: string) {
  const source = cards.find(c => c.id === active);
  const target = cards.find(c => c.id === over);
  return !!source && !!target && source.group === target.group;
}

// Split runs into balanced twos/threes without moving cards past a wide card.
export function smallCardRowSizes(count: number): number[] {
  if (count <= 0) return [];
  if (count <= 3) return [count];
  return count % 3 === 1 ? [2, ...smallCardRowSizes(count - 2)] : [3, ...smallCardRowSizes(count - 3)];
}
/** Catalogue unavailable: keep only granted Standard cards, in the fixed order. */
export function standardFallbackCards<T extends { id: string }>(cards: readonly T[]): T[] {
  const key = (id: string) => (id.includes(':') ? id.slice(id.indexOf(':') + 1) : id);
  return cards.filter(c => STANDARD_ORDER.includes(key(c.id)))
    .sort((a, b) => STANDARD_ORDER.indexOf(key(a.id)) - STANDARD_ORDER.indexOf(key(b.id)));
}
