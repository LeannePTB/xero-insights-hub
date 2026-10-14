import { describe, expect, it } from 'vitest';
import { untaggedSummary } from '../src/lib/setup-checklist.server';
import { buildClassificationResolver } from '../src/lib/cost-classification';

describe('cost classification readiness', () => {
  it('names the single untagged account', () => {
    expect(untaggedSummary(['Purchases (Cost of sales)'], 1)).toBe("Purchases (Cost of sales) isn't tagged yet.");
  });
  it('a cost-of-sales account with no stored tag is Variable, not untagged', () => {
    const r = buildClassificationResolver({ stored: [], accounts: [{ name: 'Purchases', type: 'DIRECTCOSTS' } as any] });
    expect(r.resolve('Purchases')).toMatchObject({ unclassified: false, effective: 'variable' });
  });
});
