import type { CardCatalogue } from '@/lib/cards/catalogue';

// Presentation only: callers pass the cards already granted by the database.
// Advisory module order is card_modules.sort_order: catalogue.modules arrives
// already ordered by it, so no module list is hard-coded here.
/** Fixed Tax & compliance layout; saved preferences never override it. */
export const TAX_ORDER = ['tax_obligations', 'gst_reconciliation', 'payg_withholding', 'superannuation'];
export const isFixedCardGroup = (group?: string) => group === 'tax_compliance';
export const STANDARD_ORDER = ['health', 'pnl', 'receivables', 'payables', 'notes'];
const WIDE_CARDS = new Set(['health', 'pnl', 'cashflow', 'cashflow_scenario', 'accounting_breakeven', 'transaction_search', 'tax_obligations', 'superannuation', 'notes', 'loan_consolidation']);

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
    rank: card?.package === 'standard' ? STANDARD_ORDER.indexOf(key) : group === 'tax_compliance' && TAX_ORDER.includes(key) ? TAX_ORDER.indexOf(key) - TAX_ORDER.length : catalogue.cards.findIndex(c => c.key === key),
    groupRank: moduleGroupRank(group ?? 'standard', catalogue),
    fullWidth: WIDE_CARDS.has(key),
  };
}

/** Standard first, Advisory modules in sort_order, Consolidation last. */
export function moduleGroupRank(group: string, catalogue: CardCatalogue): number {
  if (group === 'standard') return 0;
  const n = catalogue.modules.length;
  if (group === 'consolidation') return n + 2;
  const i = catalogue.modules.findIndex(m => m.key === group);
  return i < 0 ? n + 1 : 1 + i;
}

export function dashboardPackageSummary(catalogue: CardCatalogue, visible: readonly string[]) {
  const advisory = catalogue.cards.filter(c => c.package === 'advisory' && visible.includes(c.key));
  const modules = catalogue.modules.filter(m => advisory.some(c => c.module === m.key)).map(m => m.label);
  const consolidation = catalogue.cards.some(c => c.package === 'consolidation' && visible.includes(c.key));
  return `Standard${advisory.length ? ` + Advisory${modules.length ? ` (${modules.join(', ')})` : ''}` : ''}${consolidation ? ' + Consolidation' : ''}`;
}

export function orderedCardIds(ids: readonly string[], saved: readonly string[]) {
  const known = new Set(ids);
  const custom = [...new Set(saved)].filter(id => known.has(id));
  return [...custom, ...ids.filter(id => !custom.includes(id))];
}

/**
 * Saved preferences reorder within non-fixed modules, never between them. Groups keep
 * the order they arrive in (callers sort by moduleGroupRank first).
 */
export function groupedCardIds(cards: readonly { id: string; group?: string }[], saved: readonly string[]) {
  const groups = new Map(cards.map(c => [c.id, c.group ?? 'cards']));
  const groupOrder = [...new Set(cards.map(c => c.group ?? 'cards'))];
  const rank = (id: string) => groupOrder.indexOf(groups.get(id) ?? 'cards');
  // New default-first cards stay first until explicitly included in a save.
  const defaults = cards.filter(c => (c.id === 'health' || c.id.endsWith(':tax_obligations') || c.id === 'tax_obligations') && !saved.includes(c.id)).map(c => c.id);
  const taxRank = (id: string) => {
    const key = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
    const index = TAX_ORDER.indexOf(key);
    return index < 0 ? TAX_ORDER.length : index;
  };
  return orderedCardIds(cards.map(c => c.id), [...defaults, ...saved]).sort((a, b) =>
    rank(a) - rank(b) || (isFixedCardGroup(groups.get(a)) ? taxRank(a) - taxRank(b) : 0));
}

export function canReorderCards(cards: readonly { id: string; group?: string }[], active: string, over: string) {
  const source = cards.find(c => c.id === active);
  const target = cards.find(c => c.id === over);
  return !!source && !!target && !isFixedCardGroup(source.group) && source.group === target.group;
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
