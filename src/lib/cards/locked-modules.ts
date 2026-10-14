import type { CardCatalogue } from './catalogue';

export type LockedTile = { key: string; label: string; description: string };

/** Tiles for the server-listed locked modules, named only from the catalogue. */
export function lockedModuleTiles(catalogue: CardCatalogue | undefined, locked: readonly string[]): LockedTile[] {
  if (!catalogue || locked.length === 0) return [];
  const set = new Set(locked);
  const tiles: LockedTile[] = catalogue.modules.filter(m => set.has(m.key)).map(m => ({ key: m.key, label: m.label, description: m.description }));
  const cons = catalogue.cards.filter(c => c.package === 'consolidation');
  if (set.has('consolidation') && cons.length) tiles.push({ key: 'consolidation', label: 'Consolidation', description: cons[0]!.description });
  return tiles;
}
