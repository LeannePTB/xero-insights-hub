// @vitest-environment happy-dom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SortableCardGrid } from '../src/components/dashboard/SortableCardGrid';
afterEach(cleanup);
it('renders each module heading once despite an interleaved saved order', () => {
  const groups = ['standard', 'cash_flow', 'profit', 'tax_compliance', 'bookkeeping_checks', 'consolidation'];
  const cards = groups.flatMap(group => ['a', 'b'].map(key => ({ id: `${group}:${key}`, group, groupLabel: group, node: <div>{group}:{key}</div> })));
  render(<SortableCardGrid cards={cards} savedOrder={[...groups].reverse().map(g => `${g}:b`).concat(groups.map(g => `${g}:a`))} onOrderChange={vi.fn()} />);
  expect(screen.getAllByRole('heading').map(h => h.textContent)).toEqual(groups);
});