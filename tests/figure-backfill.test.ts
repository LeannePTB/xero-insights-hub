import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { completedMonthEnds, mergeHistory, nextAttempt } from '../src/lib/overview/figure-backfill';
import { freezeReportCharts } from '../src/lib/charts/report-history';

describe('figure history backfill', () => {
  it('asks for the 12 completed month-ends before today', () => {
    const m = completedMonthEnds('2026-10-14');
    expect(m).toHaveLength(12);
    expect(m[0]).toBe('2025-10-31');
    expect(m.at(-1)).toBe('2026-09-30');
  });
  it('never lets a backfilled point replace a nightly row', () => {
    const merged = mergeHistory(
      [{ client_id: 'a', tenant_id: 't', as_at: '2026-09-30', cash: 100 }],
      [{ client_id: 'a', tenant_id: 't', month_end: '2026-09-30', cash: 999 }, { client_id: 'a', tenant_id: 't', month_end: '2026-08-31', cash: 50 }],
    );
    expect(merged.find(r => r.as_at === '2026-09-30')).toMatchObject({ cash: 100, source: 'daily' });
    expect(merged.find(r => r.as_at === '2026-08-31')).toMatchObject({ cash: 50, source: 'month_end' });
  });
  it('rate limits resume later; other errors stop after five tries', () => {
    expect(nextAttempt('rate_limited', 9)).not.toBeNull();
    expect(nextAttempt('error', 5)).toBeNull();
  });
  it('report profit uses a backfilled month only when no authorised report exists, and labels it', () => {
    const r = freezeReportCharts([], [], { periodEnd: '2026-09-30', currency: 'AUD', profit: 1 }, [{ month_end: '2026-08-31', net_profit: -20 }]);
    expect(r.profit.find(p => p.date === '2026-08-31')).toMatchObject({ value: -20, source: 'xero_backfill:2026-08-31' });
  });
});

describe('13-month retention of daily figures', () => {
  it('no migration deletes from client_key_figures or client_figure_history', () => {
    for (const dir of ['supabase/migrations', 'drizzle/migrations']) {
      let files: string[] = [];
      try { files = readdirSync(dir).filter(f => f.endsWith('.sql')); } catch { continue; }
      for (const f of files) {
        const sql = readFileSync(`${dir}/${f}`, 'utf8').toLowerCase();
        expect(sql, f).not.toMatch(/delete\s+from\s+(public\.)?(client_key_figures|client_figure_history)/);
        expect(sql, f).not.toMatch(/truncate\s+(table\s+)?(public\.)?(client_key_figures|client_figure_history)/);
      }
    }
  });
});
