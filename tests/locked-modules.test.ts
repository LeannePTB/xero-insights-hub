import { describe, expect, it } from 'vitest';
import { lockedModuleTiles } from '../src/lib/cards/locked-modules';

const catalogue = {
  modules: [{ key: 'cash_flow', label: 'Cash flow', description: 'Cash ahead' }, { key: 'profit', label: 'Profit', description: 'Break-even' }],
  cards: [{ key: 'loan_consolidation', package: 'consolidation' as const, module: null, label: 'Loans', description: 'Group loans' }],
};
describe('locked module tiles', () => {
  it('names tiles from the catalogue in catalogue order', () => {
    expect(lockedModuleTiles(catalogue, ['profit', 'cash_flow']).map(t => t.label)).toEqual(['Cash flow', 'Profit']);
  });
  it('adds Consolidation only when the server lists it', () => {
    expect(lockedModuleTiles(catalogue, ['profit']).map(t => t.key)).toEqual(['profit']);
    expect(lockedModuleTiles(catalogue, ['consolidation']).map(t => t.key)).toEqual(['consolidation']);
  });
  it('shows nothing when the server lists nothing', () => {
    expect(lockedModuleTiles(catalogue, [])).toEqual([]);
  });
});
