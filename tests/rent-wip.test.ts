import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { noNegativeZero } from '../src/components/dashboard/useTenantCurrency';

describe('rent report is work in progress (14 Oct 2026)', () => {
  it('every rent server function requires a System Administrator first', () => {
    const src = readFileSync('src/lib/rent.functions.ts', 'utf8');
    const handlers = src.match(/\.handler\(async/g)?.length ?? 0;
    expect(handlers).toBeGreaterThan(0);
    expect(src.match(/await assertRentWip\(context\.supabase\);/g)?.length).toBe(handlers);
  });
  it('the rent widget is not rendered anywhere in the app', () => {
    const hits = execSync("rg -l 'RentReportWidget' src || true").toString().trim().split('\n').filter(Boolean);
    expect(hits).toEqual(['src/components/dashboard/RentReportWidget.tsx']);
  });
});

describe('money formatting', () => {
  it('a value that rounds to zero carries no minus sign', () => {
    expect(Object.is(noNegativeZero(-0), -0)).toBe(false);
    expect(Object.is(noNegativeZero(-0.4), 0)).toBe(true);
    expect(noNegativeZero(-5)).toBe(-5);
  });
});
